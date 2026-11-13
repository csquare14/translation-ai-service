import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from botocore.exceptions import ClientError
from backend.jobs.apis import create_app
from backend.jobs.auth import current_user
from backend.jobs.store import JobStore
from backend.app.security.attack_paths import find_attack_paths
from backend.app.security.resource_graph import build_resource_graph


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = JobStore(Path(self.tmp.name) / "jobs.db")
        self.app = create_app(store=self.store, start_worker=False)

    def test_routes_require_authentication(self):
        with patch("backend.jobs.config.AUTH_MODE", "clerk"), patch("backend.jobs.config.CLERK_ISSUER", "https://example.com"):
            with TestClient(self.app) as client:
                self.assertEqual(client.get("/security/overview").status_code, 401)

    def test_job_checks_enforce_owner(self):
        self.app.dependency_overrides[current_user] = lambda: "alice"
        with TestClient(self.app) as client:
            own = self.store.create("alice", "Hi", "en", "es", "source.txt")
            other = self.store.create("bob", "Hi", "en", "es", "source.txt")
            self.assertTrue(client.get(f'/security/jobs/{own["job_id"]}/check').json()["is_secure"])
            self.assertEqual(client.get(f'/security/jobs/{other["job_id"]}/check').status_code, 404)

    def test_access_denied_is_unknown_not_secure(self):
        self.app.dependency_overrides[current_user] = lambda: "alice"
        denied = ClientError({"Error": {"Code": "AccessDenied"}}, "GetBucketEncryption")
        with patch("backend.jobs.config.JOB_BACKEND", "aws"), patch.dict("os.environ", {"S3_BUCKET_NAME": "test"}), \
             patch("backend.aws.clients.s3_client") as s3:
            s3.get_bucket_encryption.side_effect = denied
            s3.get_public_access_block.side_effect = denied
            with TestClient(self.app) as client:
                result = client.get("/security/overview").json()
                self.assertEqual([c["status"] for c in result["checks"]], ["unknown", "unknown"])
                self.assertEqual(result["attackPaths"], [])
                self.assertEqual(result["findings"], [])
                self.assertEqual(result["attackAssessment"]["status"], "not_assessed")
                self.assertTrue(result["applicationPaths"])
                for path in result["applicationPaths"]:
                    self.assertEqual(path["assessment"], "connectivity_only")
                    self.assertEqual(len(path["relationships"]), len(path["nodes"]) - 1)
                self.assertTrue(all(node["risk"] == "unknown" for node in result["resources"]))

    def test_graph_edges_resolve_and_path_is_bounded(self):
        graph = build_resource_graph()
        ids = {r["id"] for r in graph["resources"]}
        self.assertTrue(all(a in ids and b in ids for a, b, _ in graph["edges"]))
        self.assertTrue(find_attack_paths(graph, "browser", "table"))
        self.assertEqual(find_attack_paths(graph, "missing", "table"), [])


if __name__ == "__main__":
    unittest.main()
