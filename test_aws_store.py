import io
import unittest
from unittest.mock import Mock

from backend.jobs.aws_store import AwsJobStore


class AwsStoreTests(unittest.TestCase):
    def setUp(self):
        self.table, self.s3 = Mock(), Mock()
        self.store = AwsJobStore(self.table, self.s3, "test-bucket")
        self.item = dict(translation_id="job-1", user_id="alice", status="awaiting_upload",
                         source_key="incoming/job-1/source.txt", created_at="2026-01-01")
        self.table.get_item.return_value = {"Item": self.item}

    def test_record_precedes_upload_with_same_id(self):
        calls = []
        def record(**kwargs):
            self.item = kwargs["Item"]
            self.table.get_item.return_value = {"Item": self.item}
            calls.append("record")
        self.table.put_item.side_effect = record
        self.s3.put_object.side_effect = lambda **kwargs: calls.append("upload")
        result = self.store.create("alice", "Hello", "en", "es", "source.txt")
        self.assertEqual(calls, ["record", "upload"])
        self.assertEqual(self.item["source_key"], f'incoming/{result["job_id"]}/source.txt')
        self.assertEqual(result["status"], "queued")

    def test_other_user_cannot_read_source_result_or_retry(self):
        self.assertIsNone(self.store.get("job-1", "bob"))
        self.assertIsNone(self.store.get_source("job-1", "bob"))
        self.assertFalse(self.store.retry("job-1", "bob"))
        self.s3.get_object.assert_not_called()
        self.table.update_item.assert_not_called()

    def test_completed_result_comes_from_report(self):
        self.item.update(status="completed", report_key="results/job-1/report.json")
        self.s3.get_object.return_value = {"Body": io.BytesIO(b'{"translated_text":"Hola"}')}
        result = self.store.get("job-1", "alice")
        self.assertEqual(result["result"]["translated_text"], "Hola")

    def test_history_paginates_and_sorts(self):
        newer = {**self.item, "translation_id": "new", "created_at": "2026-02-01"}
        self.table.scan.side_effect = [
            {"Items": [self.item], "LastEvaluatedKey": {"translation_id": "job-1"}},
            {"Items": [newer]},
        ]
        self.assertEqual(self.store.list("alice", 1)[0]["job_id"], "new")
        self.assertEqual(self.table.scan.call_count, 2)

    def test_upload_failure_records_recoverable_failure(self):
        self.s3.put_object.side_effect = ConnectionError()
        self.store.create("alice", "Hello", "en", "es", "source.txt")
        values = self.table.update_item.call_args.kwargs["ExpressionAttributeValues"]
        self.assertEqual(values[":failed"], "failed")

    def test_remote_store_does_not_start_local_worker(self):
        from fastapi.testclient import TestClient
        from backend.jobs.apis import create_app
        from unittest.mock import patch
        with patch("backend.jobs.apis.JobWorker") as worker:
            app = create_app(store=self.store)
            with TestClient(app):
                pass
            worker.return_value.start.assert_not_called()

    def test_browser_preflight_succeeds_without_authentication(self):
        from fastapi.testclient import TestClient
        from backend.jobs.apis import create_app
        with TestClient(create_app(store=self.store)) as client:
            response = client.options("/jobs", headers={
                "Origin": "http://localhost:8501",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:8501")
            self.table.put_item.assert_not_called()

    def test_retry_failed_upload_uses_saved_input_and_handles_another_failure(self):
        self.item.update(status="failed", source_text="Hello")
        self.s3.put_object.side_effect = ConnectionError()
        self.assertTrue(self.store.retry("job-1", "alice"))
        self.s3.get_object.assert_not_called()
        self.assertEqual(self.table.update_item.call_count, 2)
        self.assertEqual(self.table.update_item.call_args.kwargs[
            "ExpressionAttributeValues"][":failed"], "failed")


if __name__ == "__main__":
    unittest.main()
