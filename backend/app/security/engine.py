from pathlib import Path

from .rules import (
    ALLOWED_STATUSES,
    ALLOWED_EXTENSIONS,
    SECURITY_RULES
)


def create_finding(rule, detected_value):
    return {
        "rule_id": rule["rule_id"],
        "rule_name": rule["name"],
        "description": rule["description"],
        "severity": rule["severity"],
        "detected_value": detected_value
    }


def evaluate_job(job):
    findings = []

    if not isinstance(job, dict):
        return {
            "is_secure": False,
            "total_findings": 1,
            "findings": [{
                "rule_id": "SEC006",
                "rule_name": "INVALID_JOB_PAYLOAD",
                "description": "Job data must be a dictionary.",
                "severity": "HIGH",
                "detected_value": str(type(job).__name__)
            }]
        }

    # SEC001: Validate job status
    status = job.get("status")

    if status not in ALLOWED_STATUSES:
        findings.append(
            create_finding(SECURITY_RULES[0], status)
        )

    # SEC002: Check user identity
    user_id = job.get("user_id")

    if not isinstance(user_id, str) or not user_id.strip():
        findings.append(
            create_finding(SECURITY_RULES[1], user_id)
        )

    # SEC003: Check target language
    target_language = job.get("target_language")

    if not isinstance(target_language, str) or not target_language.strip():
        findings.append(
            create_finding(SECURITY_RULES[2], target_language)
        )

    # SEC004: Check file extension
    file_name = job.get("file_name")

    if not isinstance(file_name, str) or not file_name.strip():
        findings.append(
            create_finding(SECURITY_RULES[3], file_name)
        )
    else:
        extension = Path(file_name).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            findings.append(
                create_finding(SECURITY_RULES[3], extension)
            )

    # SEC005: Check job ID
    job_id = job.get("job_id")

    if not isinstance(job_id, str) or not job_id.strip():
        findings.append(
            create_finding(SECURITY_RULES[4], job_id)
        )

    return {
        "is_secure": len(findings) == 0,
        "total_findings": len(findings),
        "findings": findings
    }
