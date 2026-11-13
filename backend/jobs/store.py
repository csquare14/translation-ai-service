import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .config import DATA_DIR


def utc_now():
    return datetime.now(timezone.utc).isoformat()


class JobStore:
    def __init__(self, db_path=None):
        self.db_path = Path(db_path or DATA_DIR / "jobs.db")

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.db_path, timeout=15)
        try:
            connection.row_factory = sqlite3.Row
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS translation_jobs (
                    job_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    source_text TEXT NOT NULL,
                    source_language TEXT NOT NULL,
                    target_language TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at REAL NOT NULL DEFAULT 0,
                    result_json TEXT,
                    error_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS jobs_owner_created
                    ON translation_jobs(user_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS jobs_queue
                    ON translation_jobs(status, next_attempt_at, created_at);
            """)

    def create(self, user_id, text, source_language, target_language, file_name):
        job_id = str(uuid.uuid4())
        timestamp = utc_now()
        with self.connection() as connection:
            connection.execute("""
                INSERT INTO translation_jobs
                (job_id, user_id, source_text, source_language, target_language,
                 file_name, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)
            """, (job_id, user_id, text, source_language, target_language,
                  file_name, timestamp, timestamp))
        return self.get(job_id, user_id)

    @staticmethod
    def public_job(row):
        if row is None:
            return None
        job = dict(row)
        job.pop("source_text", None)
        job.pop("user_id", None)
        job.pop("next_attempt_at", None)
        result_json = job.pop("result_json")
        error_json = job.pop("error_json")
        job["result"] = json.loads(result_json) if result_json else None
        job["error"] = json.loads(error_json) if error_json else None
        return job

    def get(self, job_id, user_id):
        with self.connection() as connection:
            row = connection.execute(
                "SELECT * FROM translation_jobs WHERE job_id = ? AND user_id = ?",
                (job_id, user_id),
            ).fetchone()
        return self.public_job(row)

    def list(self, user_id, limit=50):
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT * FROM translation_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        return [self.public_job(row) for row in rows]

    def get_source(self, job_id, user_id):
        with self.connection() as connection:
            row = connection.execute(
                "SELECT source_text FROM translation_jobs WHERE job_id = ? AND user_id = ?",
                (job_id, user_id),
            ).fetchone()
        return row["source_text"] if row is not None else None

    def recover_interrupted(self):
        # The local launcher runs one API process and one worker.
        with self.connection() as connection:
            connection.execute("""
                UPDATE translation_jobs SET status = 'queued', next_attempt_at = 0,
                updated_at = ? WHERE status = 'processing'
            """, (utc_now(),))

    def claim_next(self):
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("""
                SELECT * FROM translation_jobs
                WHERE status = 'queued' AND next_attempt_at <= ?
                ORDER BY created_at LIMIT 1
            """, (time.time(),)).fetchone()
            if row is None:
                return None
            connection.execute("""
                UPDATE translation_jobs SET status = 'processing',
                attempt_count = attempt_count + 1, updated_at = ? WHERE job_id = ?
            """, (utc_now(), row["job_id"]))
            job = dict(row)
            job["attempt_count"] += 1
            return job

    def complete(self, job_id, result):
        with self.connection() as connection:
            connection.execute("""
                UPDATE translation_jobs SET status = 'completed', result_json = ?,
                error_json = NULL, updated_at = ? WHERE job_id = ? AND status = 'processing'
            """, (json.dumps(result, ensure_ascii=False), utc_now(), job_id))

    def fail(self, job_id, error, retry_delay=None):
        status = "queued" if retry_delay is not None else "failed"
        with self.connection() as connection:
            connection.execute("""
                UPDATE translation_jobs SET status = ?, error_json = ?,
                next_attempt_at = ?, updated_at = ?
                WHERE job_id = ? AND status = 'processing'
            """, (status, json.dumps(error), time.time() + (retry_delay or 0), utc_now(), job_id))

    def retry(self, job_id, user_id):
        with self.connection() as connection:
            cursor = connection.execute("""
                UPDATE translation_jobs SET status = 'queued', attempt_count = 0,
                next_attempt_at = 0, error_json = NULL, updated_at = ?
                WHERE job_id = ? AND user_id = ? AND status = 'failed'
            """, (utc_now(), job_id, user_id))
        return cursor.rowcount == 1
