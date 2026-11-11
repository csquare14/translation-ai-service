SECURITY_RULES = [
    {
        "id": "SEC001",
        "name": "Invalid Translation Status",
        "description": "Detects invalid translation job status.",
        "field": "status",
        "allowed_values": ["pending", "processing", "completed", "failed"],
        "severity": "HIGH"
    },
    {
        "id": "SEC002",
        "name": "Missing User ID",
        "description": "Detects translation jobs without a user ID.",
        "field": "user_id",
        "severity": "HIGH"
    },
    {
        "id": "SEC003",
        "name": "Missing Target Language",
        "description": "Detects jobs without a target language.",
        "field": "target_language",
        "severity": "MEDIUM"
    },
    {
        "id": "SEC004",
        "name": "Suspicious File Extension",
        "description": "Detects potentially unsafe uploaded file types.",
        "field": "filename",
        "blocked_extensions": [".exe", ".bat", ".sh", ".js"],
        "severity": "HIGH"
    }
]