
from backend.aws.storage import (
    save_document,
    save_translation,
    get_translation_history,
)

from backend.aws.clients import session, S3_BUCKET_NAME

print("\n1. Testing AWS credentials...")

sts = session.client("sts")
identity = sts.get_caller_identity()
print("AWS connection successful!")

print("\n2. Testing S3 upload...")

document_key = save_document(
    file_name="aws_test.txt",
    file_bytes=b"This is a test document for AWS integration.",
)

print("S3 upload successful!")
print("S3 key:", document_key)

print("\n3. Testing DynamoDB write...")

translation_id = save_translation(
    source_text="Hello",
    translated_text="Hola",
    source_language="en",
    target_language="es",
    detected_domain="General",
    original_s3_key=document_key,
)

print("DynamoDB write successful!")
print("Translation ID:", translation_id)

print("\n4. Testing DynamoDB history retrieval...")

history = get_translation_history()

print("History retrieved successfully!")
print("Number of records:", len(history))

print("\nAll storage integration tests completed!")
