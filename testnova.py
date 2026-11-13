import boto3
from botocore.exceptions import ClientError

client = boto3.client(
    "bedrock-runtime",
    region_name="ap-south-1"
)

try:
    response = client.converse(
        modelId="amazon.nova-micro-v1:0",
        messages=[
            {
                "role": "user",
                "content": [{"text": "Reply with hello."}]
            }
        ],
        inferenceConfig={
            "maxTokens": 30
        }
    )

    print(response["output"]["message"]["content"][0]["text"])

except ClientError as e:
    print("Error code:", e.response["Error"]["Code"])
    print("Error message:", e.response["Error"]["Message"])
    print("Request ID:", e.response["ResponseMetadata"].get("RequestId"))