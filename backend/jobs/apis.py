import json
from contextlib import asynccontextmanager
from pathlib import PurePosixPath
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from . import config
from .auth import current_user
from .store import JobStore
from .worker import JobWorker


class JobRequest(BaseModel):
    text: str
    source_language: str = Field(default="auto", pattern=r"^(auto|[a-z]{2,3}(?:-[A-Za-z0-9]+)?)$")
    target_language: str = Field(pattern=r"^[a-z]{2,3}(?:-[A-Za-z0-9]+)?$")
    file_name: str = Field(default="source.txt", max_length=255)

    @model_validator(mode="after")
    def validate_input(self):
        if not self.text.strip():
            raise ValueError("Enter text or upload a nonempty UTF-8 .txt file.")
        if len(self.text.encode("utf-8")) > config.MAX_INPUT_BYTES:
            raise ValueError("Text must contain at most 10,000 UTF-8 bytes.")
        if self.source_language == self.target_language:
            raise ValueError("Choose different source and target languages.")
        self.file_name = PurePosixPath(self.file_name.replace("\\", "/")).name or "source.txt"
        return self


def create_app(store=None, translate=None, start_worker=True):
    if store is None and config.JOB_BACKEND == "aws":
        from .aws_store import AwsJobStore
        store = AwsJobStore()
    job_store = store or JobStore()
    start_worker = start_worker and not getattr(job_store, "remote_worker", False)
    worker = JobWorker(job_store, translate=translate) if translate else JobWorker(job_store)

    @asynccontextmanager
    async def lifespan(app):
        job_store.initialize()
        if start_worker:
            worker.start()
        yield
        if start_worker:
            worker.stop()

    app = FastAPI(title="Translation Jobs", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CLERK_ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
    )
    app.state.store = job_store
    app.state.worker = worker
    from backend.app.security.routes import router as security_router
    app.include_router(security_router)
    owner = Annotated[str, Depends(current_user)]

    def owned_job(job_id, user_id):
        job = job_store.get(job_id, user_id)
        if job is None:
            raise HTTPException(404, "Job not found.")
        return job

    @app.get("/health")
    def health():
        return {"status": "ok", "auth_mode": config.AUTH_MODE}

    @app.get("/auth/me")
    def auth_me(user_id: owner):
        return {"user_id": user_id}

    @app.get("/auth/config")
    def auth_config():
        return {
            "mode": config.AUTH_MODE,
            "publishable_key": config.CLERK_PUBLISHABLE_KEY,
            "configured": bool(config.CLERK_PUBLISHABLE_KEY and config.CLERK_ISSUER),
        }

    @app.post("/jobs", status_code=202)
    def create_job(payload: JobRequest, user_id: owner):
        job = job_store.create(user_id, payload.text, payload.source_language,
                               payload.target_language, payload.file_name)
        worker.wake()
        return job

    @app.post("/jobs/upload", status_code=202)
    async def upload_job(
        user_id: owner,
        file: UploadFile = File(...),
        source_language: str = Form("auto"),
        target_language: str = Form(...),
    ):
        if not (file.filename or "").lower().endswith(".txt"):
            raise HTTPException(422, "Upload a UTF-8 .txt file.")
        content = await file.read(config.MAX_INPUT_BYTES + 1)
        await file.close()
        if len(content) > config.MAX_INPUT_BYTES:
            raise HTTPException(413, "The file exceeds 10,000 bytes.")
        try:
            payload = JobRequest(
                text=content.decode("utf-8-sig"), source_language=source_language,
                target_language=target_language, file_name=file.filename,
            )
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(422, "Use nonempty UTF-8 text and valid, different language codes.") from None
        return create_job(payload, user_id)

    @app.get("/jobs")
    def list_jobs(user_id: owner, limit: int = Query(50, ge=1, le=100)):
        return {"jobs": job_store.list(user_id, limit)}

    @app.get("/jobs/{job_id}")
    def get_job(job_id: str, user_id: owner):
        return owned_job(job_id, user_id)

    @app.post("/jobs/{job_id}/retry", status_code=202)
    def retry_job(job_id: str, user_id: owner):
        owned_job(job_id, user_id)
        if not job_store.retry(job_id, user_id):
            raise HTTPException(409, "Only failed jobs can be retried.")
        worker.wake()
        return owned_job(job_id, user_id)

    @app.get("/jobs/{job_id}/source")
    def source_document(job_id: str, user_id: owner):
        source = job_store.get_source(job_id, user_id)
        if source is None:
            raise HTTPException(404, "Job not found.")
        return Response(content=source, media_type="text/plain")

    @app.get("/jobs/{job_id}/result")
    def download_result(job_id: str, user_id: owner, format: Literal["txt", "json"] = "txt"):
        job = owned_job(job_id, user_id)
        if job["status"] != "completed":
            raise HTTPException(409, "The result is available after the job completes.")
        if format == "json":
            content = json.dumps({"job_id": job_id, **job["result"]}, ensure_ascii=False, indent=2)
            media_type = "application/json"
            filename = f"{job_id}-report.json"
        else:
            content = job["result"]["translated_text"]
            media_type = "text/plain"
            filename = f"{job_id}-translated.txt"
        return Response(content=content, media_type=media_type,
                        headers={"Content-Disposition": f'attachment; filename="{filename}"'})

    return app


app = create_app()
