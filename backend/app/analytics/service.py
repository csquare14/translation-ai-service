import sqlite3
from pathlib import Path

from . import queries

DB_PATH = Path(__file__).resolve().parents[3] / "analytics.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def execute_query(query):
    with get_connection() as connection:
        cursor = connection.execute(query)
        return [dict(row) for row in cursor.fetchall()]


def get_analytics():
    return {
        "total_jobs": execute_query(
            queries.TOTAL_JOBS_QUERY
        )[0]["total_jobs"],

        "completed_jobs": execute_query(
            queries.COMPLETED_JOBS_QUERY
        )[0]["completed_jobs"],

        "failed_jobs": execute_query(
            queries.FAILED_JOBS_QUERY
        )[0]["failed_jobs"],

        "language_usage": execute_query(
            queries.LANGUAGE_USAGE_QUERY
        ),

        "daily_usage": execute_query(
            queries.DAILY_USAGE_QUERY
        )
    }