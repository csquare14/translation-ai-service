"""S3/DynamoDB adapter using the deployed worker's job contract."""

import json
import os
import uuid

from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

from .store import utc_now


class AwsJobStore:
    remote_worker = True

    def __init__(self, table=None, s3=None, bucket=None):
        if table is None or s3 is None:
            from backend.aws.clients import dynamodb, s3_client
            table = table if table is not None else dynamodb.Table(
                os.getenv("TRANSLATION_HISTORY_TABLE", "TranslationHistory"))
            s3 = s3 if s3 is not None else s3_client
        self.table = table
        self.s3 = s3
        self.bucket = bucket or os.environ["S3_BUCKET_NAME"]

    def initialize(self):
        pass

    def _owned(self, job_id, user_id):
        item = self.table.get_item(Key={"translation_id": job_id}, ConsistentRead=True).get("Item")
        return item if item and item.get("user_id") == user_id else None

    def _read(self, key):
        body = self.s3.get_object(Bucket=self.bucket, Key=key)["Body"]
        try:
            return body.read().decode("utf-8-sig")
        finally:
            body.close()

    def _public(self, item, include_result=True):
        job = {name: item.get(name) for name in (
            "file_name", "source_language", "target_language", "created_at", "updated_at", "error")}
        job.update(job_id=item["translation_id"],
                   status="queued" if item["status"] == "awaiting_upload" else item["status"],
                   attempt_count=int(item.get("attempt_count", 0)), result=None)
        if include_result and item["status"] == "completed":
            job["result"] = json.loads(self._read(item["report_key"]))
        return job

    def create(self, user_id, text, source_language, target_language, file_name):
        job_id = str(uuid.uuid4())
        now = utc_now()
        item = dict(translation_id=job_id, user_id=user_id, file_name=file_name,
                    source_language=source_language, target_language=target_language,
                    source_key=f"incoming/{job_id}/source.txt", status="awaiting_upload",
                    source_text=text, attempt_count=0, created_at=now, updated_at=now)
        # The record must exist before the S3 notification can reach the worker.
        self.table.put_item(Item=item, ConditionExpression="attribute_not_exists(translation_id)")
        try:
            self.s3.put_object(Bucket=self.bucket, Key=item["source_key"],
                               Body=text.encode("utf-8"), ContentType="text/plain; charset=utf-8")
        except Exception:
            # A lost upload response is ambiguous: do not overwrite a worker that already claimed it.
            try:
                self.table.update_item(
                    Key={"translation_id": job_id},
                    UpdateExpression="SET #s = :failed, #e = :error",
                    ConditionExpression="#s = :waiting",
                    ExpressionAttributeNames={"#s": "status", "#e": "error"},
                    ExpressionAttributeValues={":failed": "failed", ":waiting": "awaiting_upload",
                        ":error": {"code": "UploadFailed", "message": "Input upload failed. Retry this job."}})
            except ClientError as error:
                if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
                    raise
        return self.get(job_id, user_id)

    def get(self, job_id, user_id):
        item = self._owned(job_id, user_id)
        return self._public(item) if item else None

    def get_source(self, job_id, user_id):
        item = self._owned(job_id, user_id)
        return self._read(item["source_key"]) if item else None

    def list(self, user_id, limit=50):
        # Small-demo fallback for the existing table. Add an owner/created_at GSI before scaling.
        items = []
        options = {"FilterExpression": Attr("user_id").eq(user_id), "ConsistentRead": True}
        while True:
            page = self.table.scan(**options)
            items.extend(page.get("Items", []))
            if not page.get("LastEvaluatedKey"):
                break
            options["ExclusiveStartKey"] = page["LastEvaluatedKey"]
        items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return [self._public(item) for item in items[:limit]]

    def retry(self, job_id, user_id):
        item = self._owned(job_id, user_id)
        if not item or item["status"] != "failed":
            return False
        # Re-uploading the original object sends a fresh notification to SQS.
        source = item.get("source_text")
        if source is None:
            source = self._read(item["source_key"])
        try:
            self.table.update_item(
                Key={"translation_id": job_id},
                UpdateExpression="SET #s = :waiting, updated_at = :now REMOVE #e",
                ConditionExpression="#s = :failed AND user_id = :owner",
                ExpressionAttributeNames={"#s": "status", "#e": "error"},
                ExpressionAttributeValues={":waiting": "awaiting_upload", ":failed": "failed",
                                           ":owner": user_id, ":now": utc_now()})
        except ClientError as error:
            if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise
        try:
            self.s3.put_object(Bucket=self.bucket, Key=item["source_key"], Body=source.encode("utf-8"),
                               ContentType="text/plain; charset=utf-8")
        except Exception:
            try:
                self.table.update_item(
                    Key={"translation_id": job_id},
                    UpdateExpression="SET #s = :failed, #e = :error",
                    ConditionExpression="#s = :waiting AND user_id = :owner",
                    ExpressionAttributeNames={"#s": "status", "#e": "error"},
                    ExpressionAttributeValues={":failed": "failed", ":waiting": "awaiting_upload",
                        ":owner": user_id,
                        ":error": {"code": "UploadFailed", "message": "Input upload failed. Retry this job."}})
            except ClientError as error:
                if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
                    raise
        return True
