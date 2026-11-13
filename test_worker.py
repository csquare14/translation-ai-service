import io
import json
import unittest
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

import worker_handler as worker


class WorkerTests(unittest.TestCase):
    def test_decimal_quality_is_compatible_with_dynamodb(self):
        from boto3.dynamodb.types import TypeSerializer
        self.pipeline.return_value["quality_report"]["quality_score"] = 94.5
        worker.handler(self.event, self.context)
        values = self.table.update_item.call_args.kwargs["ExpressionAttributeValues"]
        serialized = TypeSerializer().serialize(values[":quality"])
        self.assertEqual(serialized["M"]["quality_score"], {"N": "94.5"})

    def setUp(self):
        self.table = Mock()
        self.s3 = Mock()
        self.pipeline = Mock(return_value={
            "translated_text": "Hola",
            "source_language": "en",
            "target_language": "es",
            "detected_domain": "General",
            "translation_source": "Amazon Translate",
            "quality_report": {"quality_score": 95},
        })
        for name, replacement in (
            ("table", self.table),
            ("s3_client", self.s3),
            ("process_translation_pipeline", self.pipeline),
        ):
            patcher = patch.object(worker, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.context = Mock()
        self.context.get_remaining_time_in_millis.return_value = 180000
        self.job = {
            "status": "awaiting_upload",
            "source_key": "incoming/job-1/source.txt",
            "source_language": "en",
            "target_language": "es",
        }
        self.table.get_item.return_value = {"Item": self.job}
        self.s3.get_object.return_value = {"Body": io.BytesIO(b"Hello")}
        self.record = {"s3": {
            "bucket": {"name": worker.BUCKET},
            "object": {"key": self.job["source_key"], "versionId": "version-1"},
        }}
        self.event = {"Records": [{
            "messageId": "message-1",
            "body": json.dumps({"Records": [self.record]}),
        }]}

    def test_translation_preserves_job_id_and_source_version(self):
        worker.handler(self.event, self.context)
        self.pipeline.assert_called_once_with("Hello", source_lang="en", target_lang="es")
        self.s3.get_object.assert_called_once_with(
            Bucket=worker.BUCKET, Key=self.job["source_key"], VersionId="version-1"
        )
        output, report = self.s3.put_object.call_args_list
        self.assertEqual(output.kwargs["Key"], "results/job-1/output.txt")
        self.assertEqual(output.kwargs["Body"], b"Hola")
        self.assertEqual(json.loads(report.kwargs["Body"])["translation_id"], "job-1")
        completed = self.table.update_item.call_args.kwargs
        self.assertEqual(completed["Key"], {"translation_id": "job-1"})
        self.assertEqual(completed["ExpressionAttributeValues"][":completed"], "completed")
        self.assertIn("worker_token = :token", completed["ConditionExpression"])

    def test_completed_duplicate_does_not_translate_again(self):
        self.job["status"] = "completed"
        worker.handler(self.event, self.context)
        self.pipeline.assert_not_called()
        self.s3.get_object.assert_not_called()

    def test_failure_updates_job_and_retries_batch(self):
        self.pipeline.side_effect = RuntimeError("secret provider response")
        with self.assertRaises(RuntimeError):
            worker.handler(self.event, self.context)
        values = self.table.update_item.call_args.kwargs["ExpressionAttributeValues"]
        self.assertEqual(values[":failed"], "failed")
        self.assertNotIn("secret", json.dumps(values))
        self.s3.put_object.assert_not_called()

    def test_failed_job_can_be_retried(self):
        self.job["status"] = "failed"
        worker.handler(self.event, self.context)
        self.pipeline.assert_called_once()

    def test_active_worker_contention_is_retried(self):
        self.job["status"] = "processing"
        self.table.update_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem"
        )
        with self.assertRaises(RuntimeError):
            worker.handler(self.event, self.context)
        self.pipeline.assert_not_called()

    def test_missing_language_and_oversized_input_fail(self):
        del self.job["target_language"]
        with self.assertRaises(RuntimeError):
            worker.handler(self.event, self.context)
        self.s3.get_object.assert_not_called()
        self.job["target_language"] = "es"
        self.s3.get_object.return_value = {"Body": io.BytesIO(b"a" * 10001)}
        with self.assertRaises(RuntimeError):
            worker.handler(self.event, self.context)
        self.pipeline.assert_not_called()

    def test_unrelated_upload_is_ignored(self):
        self.record["s3"]["object"]["key"] = "results/job-1/output.txt"
        worker.process_record(self.record, self.context)
        self.table.get_item.assert_not_called()


if __name__ == "__main__":
    unittest.main()
