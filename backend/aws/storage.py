
import uuid
from datetime import datetime, timezone

from backend.aws.clients import (
    s3_client,
    S3_BUCKET_NAME,
    get_history_table,
)


def save_document(file_name: str, file_bytes: bytes) -> str:
    """Upload original document to S3."""

    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME is missing.")

    document_id = str(uuid.uuid4())
    s3_key = f"documents/{document_id}/{file_name}"

    s3_client.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        Body=file_bytes,
    )

    return s3_key


def save_translation(
    source_text: str,
    translated_text: str,
    source_language: str,
    target_language: str,
    detected_domain: str,
    original_s3_key: str = None,
) -> str:

    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME is missing.")

    translation_id = str(uuid.uuid4())

    translated_key = (
        f"translations/{translation_id}/translated.txt"
    )

    s3_client.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=translated_key,
        Body=translated_text.encode("utf-8"),
        ContentType="text/plain; charset=utf-8",
    )

    record = {
        "translation_id": translation_id,
        "source_language": source_language,
        "target_language": target_language,
        "detected_domain": detected_domain,
        "original_s3_key": original_s3_key or "",
        "translated_s3_key": translated_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    get_history_table().put_item(Item=record)

    return translation_id


def get_translation_history(limit: int = 20) -> list:

    response = get_history_table().scan(
        Limit=limit
    )

    records = response.get("Items", [])

    return sorted(
        records,
        key=lambda item: item.get("created_at", ""),
        reverse=True,
    )


def get_translated_document(s3_key: str) -> str:

    response = s3_client.get_object(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
    )

    return response["Body"].read().decode("utf-8")
