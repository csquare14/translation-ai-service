"""Translate UTF-8 text uploaded through the S3 -> SQS job workflow."""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import unquote_plus

from botocore.exceptions import ClientError

from ai_core.pipeline import process_translation_pipeline
from backend.aws.clients import dynamodb, s3_client


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

BUCKET = os.getenv("S3_BUCKET_NAME", "translation-ai-documents-rashi-2026")
table = dynamodb.Table(os.getenv("TRANSLATION_HISTORY_TABLE", "TranslationHistory"))


def process_record(record, context):
    details = record.get("s3")
    if not details or details["bucket"]["name"] != BUCKET:
        return

    obj = details["object"]
    source_key = unquote_plus(obj["key"])
    parts = source_key.split("/")
    if len(parts) != 3 or parts[0] != "incoming" or parts[2] != "source.txt":
        return

    job_id = parts[1]
    key = {"translation_id": job_id}
    job = table.get_item(Key=key, ConsistentRead=True).get("Item", {})
    if job.get("source_key") != source_key or job.get("status") == "completed":
        return
    if job.get("status") not in {"awaiting_upload", "processing", "failed"}:
        return

    # A lease outlives this invocation so a retry can recover after a timeout.
    now = int(time.time())
    remaining_seconds = context.get_remaining_time_in_millis() // 1000
    worker_token = str(uuid.uuid4())
    try:
        table.update_item(
            Key=key,
            UpdateExpression=(
                "SET #status = :processing, worker_token = :token, "
                "lease_until = :lease ADD attempt_count :one"
            ),
            ConditionExpression=(
                "source_key = :source AND (#status IN (:waiting, :failed) "
                "OR (#status = :processing AND lease_until < :now))"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":source": source_key,
                ":waiting": "awaiting_upload",
                ":failed": "failed",
                ":processing": "processing",
                ":token": worker_token,
                ":lease": now + remaining_seconds + 30,
                ":now": now,
                ":one": 1,
            },
        )
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            # A concurrent invocation may have completed since our first read.
            current = table.get_item(Key=key, ConsistentRead=True).get("Item", {})
            if current.get("status") == "completed":
                return
        raise

    try:
        target_language = job.get("target_language")
        if not isinstance(target_language, str) or not target_language.strip():
            raise ValueError("The job requires target_language.")

        get_options = {"Bucket": BUCKET, "Key": source_key}
        if obj.get("versionId"):
            get_options["VersionId"] = obj["versionId"]
        response = s3_client.get_object(**get_options)
        body = response["Body"]
        try:
            source_bytes = body.read(10001)
        finally:
            body.close()

        if len(source_bytes) > 10000:
            raise ValueError("Input exceeds the 10,000-byte text limit.")
        text = source_bytes.decode("utf-8-sig")
        if not text.strip():
            raise ValueError("The source file is empty.")

        result = process_translation_pipeline(
            text,
            source_lang=job.get("source_language", "auto"),
            target_lang=target_language.strip(),
        )
        result_key = f"results/{job_id}/output.txt"
        report_key = f"results/{job_id}/report.json"
        s3_client.put_object(
            Bucket=BUCKET,
            Key=result_key,
            Body=result["translated_text"].encode("utf-8"),
            ContentType="text/plain; charset=utf-8",
        )
        s3_client.put_object(
            Bucket=BUCKET,
            Key=report_key,
            Body=json.dumps({"translation_id": job_id, **result}, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json; charset=utf-8",
        )
        table.update_item(
            Key=key,
            UpdateExpression=(
                "SET #status = :completed, result_key = :result, report_key = :report, "
                "source_language = :source_language, target_language = :target_language, "
                "detected_domain = :domain, quality_report = :quality, "
                "translation_source = :translation_source, updated_at = :updated "
                "REMOVE worker_token, lease_until, #error"
            ),
            ConditionExpression="#status = :processing AND worker_token = :token",
            ExpressionAttributeNames={"#status": "status", "#error": "error"},
            ExpressionAttributeValues={
                ":completed": "completed",
                ":processing": "processing",
                ":token": worker_token,
                ":result": result_key,
                ":report": report_key,
                ":source_language": result["source_language"],
                ":target_language": result["target_language"],
                ":domain": result["detected_domain"],
                ":quality": json.loads(json.dumps(result["quality_report"]), parse_float=Decimal),
                ":translation_source": result["translation_source"],
                ":updated": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info("Completed job %s", job_id)
    except Exception as error:
        # Keep provider responses and document contents out of the job record.
        error_code = type(error).__name__
        table.update_item(
            Key=key,
            UpdateExpression=(
                "SET #status = :failed, #error = :error, updated_at = :updated "
                "REMOVE worker_token, lease_until"
            ),
            ConditionExpression="#status = :processing AND worker_token = :token",
            ExpressionAttributeNames={"#status": "status", "#error": "error"},
            ExpressionAttributeValues={
                ":failed": "failed",
                ":processing": "processing",
                ":token": worker_token,
                ":error": {"code": error_code, "message": "Translation processing failed."},
                ":updated": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.error("Job %s failed (%s)", job_id, error_code)
        raise


def handler(event, context):
    failed_messages = []
    for message in event["Records"]:
        try:
            body = json.loads(message["body"])
            for record in body.get("Records", []):
                process_record(record, context)
        except Exception as error:
            failed_messages.append(message.get("messageId", "unknown"))
            logger.error("SQS message failed (%s)", type(error).__name__)

    if failed_messages:
        # Raising retries the batch without requiring partial-batch configuration.
        raise RuntimeError(f"Failed to process {len(failed_messages)} SQS message(s).")

    return {"processed_messages": len(event["Records"])}
