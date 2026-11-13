import base64
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from backend.jobs import config
from backend.jobs.apis import create_app
from backend.jobs.store import JobStore


def translation(text, source, target):
    return {
        "translated_text": "Translated " + text,
        "source_language": "en" if source == "auto" else source,
        "target_language": target,
        "detected_domain": "General",
        "translation_source": "Test translator",
        "quality_report": {"quality_score": 95, "flagged_issues": []},
    }


class LocalJobTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = JobStore(Path(self.directory.name) / "jobs.db")
        self.translate = Mock(side_effect=translation)
        self.app = create_app(self.store, self.translate, start_worker=False)
        self.worker = self.app.state.worker
        settings = {
            "AUTH_MODE": "clerk", "CLERK_ISSUER": "https://clerk.example.test",
            "CLERK_ALLOWED_ORIGINS": ["http://localhost:8501"], "CLERK_AUDIENCE": None,
        }
        for name, value in settings.items():
            patcher = patch.object(config, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        keys = Mock()
        keys.get_signing_key_from_jwt.return_value = SimpleNamespace(key=self.private_key.public_key())
        patcher = patch("backend.jobs.auth.signing_keys", return_value=keys)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def headers(self, user="user-one", **changes):
        now = int(time.time())
        claims = {
            "sub": user, "sid": "session-123", "iss": config.CLERK_ISSUER,
            "azp": "http://localhost:8501", "iat": now, "nbf": now, "exp": now + 60,
        }
        claims.update(changes)
        token = jwt.encode(claims, self.private_key, algorithm="RS256")
        return {"Authorization": "Bearer " + token}

    def create(self, text="Hello", user="user-one"):
        response = self.client.post("/jobs", headers=self.headers(user), json={
            "text": text, "source_language": "en", "target_language": "es",
        })
        self.assertEqual(response.status_code, 202, response.text)
        return response.json()["job_id"]

    def test_two_uploads_complete_independently_and_download(self):
        job_ids = []
        for text in ("First input", "Second input"):
            response = self.client.post("/jobs/upload", headers=self.headers(),
                files={"file": ("sample.txt", text.encode(), "text/plain")},
                data={"source_language": "en", "target_language": "es"})
            self.assertEqual(response.status_code, 202, response.text)
            job_ids.append(response.json()["job_id"])
        self.assertNotEqual(*job_ids)
        self.worker.process_one()
        self.worker.process_one()
        for job_id, text in zip(job_ids, ("First input", "Second input")):
            status = self.client.get(f"/jobs/{job_id}", headers=self.headers()).json()
            self.assertEqual(status["status"], "completed")
            download = self.client.get(f"/jobs/{job_id}/result", headers=self.headers())
            self.assertEqual(download.text, "Translated " + text)
            report = self.client.get(f"/jobs/{job_id}/result?format=json", headers=self.headers()).json()
            self.assertEqual(report["job_id"], job_id)
            self.assertEqual(report["quality_report"]["quality_score"], 95)

    def test_ownership_applies_to_status_download_retry_and_history(self):
        job_id = self.create()
        self.worker.process_one()
        other = self.headers("user-two")
        for suffix in ("", "/result", "/source"):
            self.assertEqual(self.client.get(f"/jobs/{job_id}{suffix}", headers=other).status_code, 404)
        self.assertEqual(self.client.post(f"/jobs/{job_id}/retry", headers=other).status_code, 404)
        self.assertEqual(self.client.get("/jobs", headers=other).json(), {"jobs": []})
        source = self.client.get(f"/jobs/{job_id}/source", headers=self.headers())
        self.assertEqual(source.status_code, 200)
        self.assertEqual(source.text, "Hello")

    def test_permanent_failure_and_manual_retry_keep_the_same_id(self):
        job_id = self.create()
        self.translate.side_effect = ValueError("private source content")
        self.worker.process_one()
        failed = self.store.get(job_id, "user-one")
        self.assertEqual(failed["status"], "failed")
        self.assertNotIn("private", str(failed))
        self.assertEqual(self.client.get(f"/jobs/{job_id}/result", headers=self.headers()).status_code, 409)
        retried = self.client.post(f"/jobs/{job_id}/retry", headers=self.headers())
        self.assertEqual(retried.status_code, 202)
        self.assertEqual(retried.json()["job_id"], job_id)
        self.translate.side_effect = translation
        self.worker.process_one()
        self.assertEqual(self.store.get(job_id, "user-one")["status"], "completed")

    def test_transient_failures_retry_then_stop_after_three_attempts(self):
        job_id = self.create()
        self.translate.side_effect = TimeoutError("timeout")
        now = time.time()
        for attempt in range(3):
            with patch("backend.jobs.store.time.time", return_value=now + attempt * 100):
                self.assertTrue(self.worker.process_one())
        job = self.store.get(job_id, "user-one")
        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["attempt_count"], 3)
        self.assertFalse(self.worker.process_one())

    def test_restart_preserves_results_and_recovers_interrupted_jobs(self):
        completed = self.create("Completed")
        interrupted = self.create("Interrupted")
        self.worker.process_one()
        self.store.claim_next()
        reopened = JobStore(self.store.db_path)
        reopened.initialize()
        reopened.recover_interrupted()
        self.assertEqual(reopened.get(completed, "user-one")["result"]["translated_text"], "Translated Completed")
        self.assertEqual(reopened.get(interrupted, "user-one")["status"], "queued")

    def test_concurrent_claims_get_distinct_jobs(self):
        expected = {self.create("One"), self.create("Two")}
        with ThreadPoolExecutor(max_workers=2) as pool:
            claims = list(pool.map(lambda _: self.store.claim_next(), range(2)))
        self.assertEqual({job["job_id"] for job in claims}, expected)

    def test_invalid_uploads_and_input_are_rejected(self):
        for filename, data in [("file.pdf", b"Hello"), ("file.txt", b"\xff"),
                               ("file.txt", b" "), ("file.txt", b"x" * 10001)]:
            response = self.client.post("/jobs/upload", headers=self.headers(),
                files={"file": (filename, data)}, data={"target_language": "es"})
            self.assertIn(response.status_code, (413, 422))
        for text in ("", "é" * 5001):
            response = self.client.post("/jobs", headers=self.headers(),
                                        json={"text": text, "target_language": "es"})
            self.assertEqual(response.status_code, 422)

    def test_missing_expired_wrong_issuer_origin_and_pending_tokens_are_rejected(self):
        self.assertEqual(self.client.get("/jobs").status_code, 401)
        for changes in ({"exp": int(time.time()) - 60}, {"iss": "https://other.example"},
                        {"azp": "https://other.example"}, {"sts": "pending"}, {"sid": ""}):
            self.assertEqual(self.client.get("/jobs", headers=self.headers(**changes)).status_code, 401)

    def test_invalid_signature_is_rejected(self):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        token = jwt.encode({"sub": "attacker"}, other_key, algorithm="RS256")
        response = self.client.get("/jobs", headers={"Authorization": "Bearer " + token})
        self.assertEqual(response.status_code, 401)

    def test_configured_audience_is_checked(self):
        with patch.object(config, "CLERK_AUDIENCE", "translation-app"):
            self.assertEqual(self.client.get("/jobs", headers=self.headers()).status_code, 401)
            self.assertEqual(self.client.get("/jobs", headers=self.headers(aud="translation-app")).status_code, 200)

    def test_demo_mode_is_explicit_and_loopback_only(self):
        with patch.object(config, "AUTH_MODE", "demo"):
            local = TestClient(self.app, client=("127.0.0.1", 1234))
            remote = TestClient(self.app, client=("203.0.113.10", 1234))
            try:
                self.assertEqual(local.get("/auth/me").json(), {"user_id": "local-demo"})
                self.assertEqual(remote.get("/jobs").status_code, 403)
            finally:
                local.close()
                remote.close()

    def test_issuer_can_be_derived_from_a_publishable_key(self):
        encoded = base64.b64encode(b"example.clerk.accounts.dev$").decode().rstrip("=")
        self.assertEqual(config.issuer_from_publishable_key("pk_test_" + encoded),
                         "https://example.clerk.accounts.dev")
        for key in ["", "sk_test_private", "pk_test_invalid", "pk_test_Li4vJ A=="]:
            self.assertEqual(config.issuer_from_publishable_key(key), "")

    def test_background_worker_processes_submitted_job(self):
        with tempfile.TemporaryDirectory() as directory:
            store = JobStore(Path(directory) / "threaded.db")
            app = create_app(store, self.translate)
            with TestClient(app) as client:
                response = client.post("/jobs", headers=self.headers(),
                    json={"text": "Background job", "target_language": "es"})
                job_id = response.json()["job_id"]
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    job = client.get(f"/jobs/{job_id}", headers=self.headers()).json()
                    if job["status"] == "completed":
                        break
                    time.sleep(0.05)
                self.assertEqual(job["status"], "completed")


if __name__ == "__main__":
    unittest.main()
