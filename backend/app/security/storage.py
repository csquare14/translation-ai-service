import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[3] / "analytics.db"


def initialize_storage():
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS security_findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT NOT NULL,
                rule_name TEXT NOT NULL,
                severity TEXT NOT NULL,
                description TEXT,
                detected_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


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