import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[3] / "analytics.db"

SCHEMA_PATH = Path(__file__).resolve().parent / "sql" / "security_findings.sql"


def initialize_storage():
    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    with sqlite3.connect(DB_PATH) as connection:
        connection.executescript(schema)


def save_findings(findings):
    initialize_storage()

    with sqlite3.connect(DB_PATH) as connection:
        for finding in findings:
            connection.execute("""
                INSERT INTO security_findings
                (rule_id, rule_name, severity, description, detected_value)
                VALUES (?, ?, ?, ?, ?)
            """, (
                finding["rule_id"],
                finding["rule_name"],
                finding["severity"],
                finding["description"],
                str(finding["detected_value"])
            ))


def get_findings():
    initialize_storage()

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row

        cursor = connection.execute("""
            SELECT * FROM security_findings
            ORDER BY created_at DESC
        """)

        return [dict(row) for row in cursor.fetchall()]
