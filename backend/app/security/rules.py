ALLOWED_STATUSES = {"pending", "processing", "completed", "failed"}

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".doc", ".pptx", ".xlsx"}

SECURITY_RULES = [
    {
        "rule_id": "SEC001",
        "name": "INVALID_JOB_STATUS",
        "severity": "HIGH",
        "description": "Translation job has an invalid status."
    },
    {
        "rule_id": "SEC002",
        "name": "MISSING_USER_ID",
        "severity": "HIGH",
        "description": "Translation job is missing user identity."
    },
    {
        "rule_id": "SEC003",
        "name": "MISSING_TARGET_LANGUAGE",
        "severity": "MEDIUM",
        "description": "Translation job has no target language."
    },
    {
        "rule_id": "SEC004",
        "name": "UNSUPPORTED_FILE_EXTENSION",
        "severity": "HIGH",
        "description": "Uploaded file has an unsupported extension."
    },
    {
        "rule_id": "SEC005",
        "name": "MISSING_JOB_ID",
        "severity": "HIGH",
        "description": "Translation job is missing its unique job ID."
    },
    {
        "rule_id": "SEC006",
        "name": "INVALID_JOB_PAYLOAD",
        "severity": "HIGH",
        "description": "Job data must be a dictionary."
    }
]
