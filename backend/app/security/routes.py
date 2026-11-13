"""Authenticated security views for the FastAPI job application."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from botocore.exceptions import ClientError, BotoCoreError
from backend.jobs.auth import current_user
from backend.jobs import config
from .engine import evaluate_job
from .resource_graph import build_resource_graph
from .attack_paths import find_attack_paths

router = APIRouter(prefix="/security", dependencies=[Depends(current_user)])


@router.get("/overview")
def overview():
    graph = build_resource_graph()
    checks, findings = [], []
    def check(name, operation, evaluate):
        try:
            state = "passed" if evaluate(operation()) else "failed"
        except (ClientError, BotoCoreError):
            state = "unknown"
        checks.append({"name": name, "resource": "bucket", "status": state})
        if state == "failed":
            findings.append(dict(id=f"storage-{len(findings)+1}", title=name + ": " + state,
                resource="bucket", severity="high" if state == "failed" else "low",
                category="Storage verification", recommendation="Review the storage configuration." if state == "failed" else
                    "The API could not verify this setting. Review its read permissions and AWS configuration."))
    if config.JOB_BACKEND == "aws":
        from backend.aws.clients import s3_client
        import os
        bucket = os.environ["S3_BUCKET_NAME"]
        check("S3 default encryption", lambda: s3_client.get_bucket_encryption(Bucket=bucket),
              lambda r: any(rule.get("ApplyServerSideEncryptionByDefault", {}).get("SSEAlgorithm")
                  in {"AES256", "aws:kms", "aws:kms:dsse"}
                  for rule in r["ServerSideEncryptionConfiguration"]["Rules"]))
        check("S3 public access blocks", lambda: s3_client.get_public_access_block(Bucket=bucket),
              lambda r: all(r["PublicAccessBlockConfiguration"].get(k) is True for k in
                  ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")))
    else:
        checks.append({"name": "AWS storage checks", "resource": "bucket", "status": "unknown"})
    application_paths = []
    for target in ("bucket", "table"):
        for nodes in find_attack_paths(graph, "browser", target):
            application_paths.append({"id": f"APP-{len(application_paths)+1:03d}",
                "nodes": nodes, "assessment": "connectivity_only",
                "relationships": [next(label for source, destination, label in graph["edges"]
                    if source == a and destination == b) for a, b in zip(nodes, nodes[1:])]})
    return {**graph, "findings": findings, "attackPaths": [], "checks": checks,
        "applicationPaths": application_paths,
        "relationships": [{"source": a, "target": b, "relationship": label}
                          for a, b, label in graph["edges"]],
        "attackAssessment": {"status": "not_assessed", "reason":
            "Network reachability and effective IAM permissions have not been evaluated."},
        "source": "Configured application topology with live storage checks",
        "limitations": "Not an account-wide inventory or IAM/network attack-path audit. Unknown checks are not passes. No verified attack paths have been assessed.",
        "checked_at": datetime.now(timezone.utc).isoformat()}


@router.get("/jobs/{job_id}/check")
def check_job(job_id: str, request: Request, user_id: str = Depends(current_user)):
    job = request.app.state.store.get(job_id, user_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    return evaluate_job({**job, "user_id": user_id})
