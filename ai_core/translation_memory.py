import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "translation_memory.db"


def initialize_database():
    """Create the translation memory table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS translation_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            source_language TEXT NOT NULL,
            target_language TEXT NOT NULL,
            domain TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()



def save_translation(source_text, translated_text,
                     source_language, target_language, domain):
    """Save a translation without inserting an exact duplicate."""
    conn = sqlite3.connect(DB_PATH)

    try:
        conn.execute("""
            INSERT INTO translation_memory
            (source_text, translated_text, source_language,
             target_language, domain)
            SELECT ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1 FROM translation_memory
                WHERE source_text = ?
                AND translated_text = ?
                AND source_language = ?
                AND target_language = ?
                AND domain = ?
            )
        """, (
            source_text, translated_text, source_language,
            target_language, domain,
            source_text, translated_text, source_language,
            target_language, domain
        ))
        conn.commit()
    finally:
        conn.close()



def find_translation(source_text, source_language,
                     target_language, domain):
    """Find an exact previously saved translation."""
    conn = sqlite3.connect(DB_PATH)

    cursor = conn.execute("""
        SELECT translated_text
        FROM translation_memory
        WHERE source_text = ?
        AND source_language = ?
        AND target_language = ?
        AND domain = ?
        LIMIT 1
    """, (source_text, source_language, target_language, domain))

    result = cursor.fetchone()
    conn.close()

    return result[0] if result else None

def find_translation_auto(source_text, target_language, domain):
    """Find a cached translation when the source language is unambiguous."""
    conn = sqlite3.connect(DB_PATH)

    try:
        cursor = conn.execute("""
            SELECT DISTINCT source_language
            FROM translation_memory
            WHERE source_text = ?
            AND target_language = ?
            AND domain = ?
        """, (source_text, target_language, domain))

        languages = cursor.fetchall()

        if len(languages) != 1:
            return None

        detected_language = languages[0][0]

        return find_translation(
            source_text,
            detected_language,
            target_language,
            domain
        ), detected_language

    finally:
        conn.close()
