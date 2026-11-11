from pathlib import Path

from .rules import SECURITY_RULES


def evaluate_job(job):
    findings = []

    for rule in SECURITY_RULES:

        field = rule["field"]
        value = job.get(field)

        if rule["id"] == "SEC001":
            if value not in rule["allowed_values"]:
                findings.append(create_finding(rule, value))

        elif rule["id"] == "SEC002":
            if not value:
                findings.append(create_finding(rule, value))

        elif rule["id"] == "SEC003":
            if not value:
                findings.append(create_finding(rule, value))

        elif rule["id"] == "SEC004":
            if value:
                extension = Path(value).suffix.lower()

                if extension in rule["blocked_extensions"]:
                    findings.append(create_finding(rule, value))

    return {
        "is_secure": len(findings) == 0,
        "total_findings": len(findings),
        "findings": findings
    }


def create_finding(rule, detected_value):
    return {
        "rule_id": rule["id"],
        "rule_name": rule["name"],
        "description": rule["description"],
        "severity": rule["severity"],
        "detected_value": detected_value
    }