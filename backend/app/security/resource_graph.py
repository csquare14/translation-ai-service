"""Configured application topology, not an AWS account inventory scan."""
import os


def build_resource_graph():
    definitions = [
        ("browser", "CloudQuery frontend", "Frontend", 70, 80),
        ("clerk", "Clerk identity", "Identity", 350, 30),
        ("gateway", "API Gateway", "API", 350, 200),
        ("api", "translation-api", "Lambda", 650, 200),
        ("bucket", os.getenv("S3_BUCKET_NAME", "Not configured"), "S3 bucket", 950, 200),
        ("queue", "translation-jobs", "SQS", 950, 380),
        ("worker", "translation-worker", "Lambda", 650, 500),
        ("table", os.getenv("TRANSLATION_HISTORY_TABLE", "TranslationHistory"), "DynamoDB", 350, 500),
    ]
    return {
        "resources": [dict(id=i, name=n, type=t, x=x, y=y, risk="unknown",
            note="Configured application component. Security posture requires separate verification.")
            for i, n, t, x, y in definitions],
        "edges": [["browser", "clerk", "sign-in"], ["browser", "gateway", "HTTPS + token"],
            ["gateway", "api", "invoke"], ["api", "bucket", "upload"],
            ["bucket", "queue", "object event"], ["queue", "worker", "process"],
            ["worker", "bucket", "save results"], ["api", "table", "owned jobs"],
            ["worker", "table", "status update"]],
    }
