
import importlib
import os

import boto3
from botocore.config import Config


def load_dotenv(*args, **kwargs):
    if importlib.util.find_spec("dotenv") is None:
        return False

    from dotenv import load_dotenv as _load_dotenv # pyright: ignore[reportMissingImports]

    return _load_dotenv(*args, **kwargs)


load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "anthropic.claude-3-haiku-20240307-v1:0"
)

session = boto3.Session(region_name=AWS_REGION)

retry_config = Config(
    retries={
        "max_attempts": 5,
        "mode": "standard",
    }
)

# Bedrock client
bedrock_runtime = session.client(
    "bedrock-runtime",
    config=retry_config,
)

# Amazon Translate client
translate_client = session.client(
    "translate",
    config=retry_config,
)

# S3 client
s3_client = session.client(
    "s3",
    config=retry_config,
)

# DynamoDB resource
dynamodb = session.resource(
    "dynamodb",
    config=retry_config,
)


def get_history_table():
    table_name = os.getenv("TRANSLATION_HISTORY_TABLE")

    if not table_name:
        raise RuntimeError(
            "TRANSLATION_HISTORY_TABLE environment variable is missing."
        )

    return dynamodb.Table(table_name)
