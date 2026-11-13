import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def generate_structured_response(prompt: str, schema: type[BaseModel]) -> BaseModel:
    """Generate and validate a JSON response using the configured Gemini model."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    with genai.Client(
        api_key=api_key,
        http_options={"timeout": 30000, "retry_options": {"attempts": 2}},
    ) as client:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_json_schema": schema.model_json_schema(),
            },
        )

    return schema.model_validate_json(response.text)
