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
    """Save a translated sentence in the database."""
    conn = sqlite3.connect(DB_PATH)

    conn.execute("""
        INSERT INTO translation_memory
        (source_text, translated_text, source_language,
         target_language, domain)
        VALUES (?, ?, ?, ?, ?)
    """, (source_text, translated_text, source_language,
          target_language, domain))

    conn.commit()
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