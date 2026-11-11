
import json

from pydantic import BaseModel, Field

from backend.aws.clients import bedrock_runtime, BEDROCK_MODEL_ID


class QualityReport(BaseModel):
    quality_score: int = Field(
        ge=1,
        le=100,
        description="Score between 1 and 100",
    )
    fluency_rating: str
    terminology_accuracy: str
    flagged_issues: list[str]
    suggestions: str


def evaluate_translation(
    source_text: str,
    translated_text: str,
    domain: str,
) -> dict:

    prompt = f"""
    You are a professional linguistic quality evaluator
    for the {domain} domain.

    Compare the source and translated text.

    Source Text:
    {source_text[:4000]}

    Translated Text:
    {translated_text[:4000]}

    Evaluate:
    1. Meaning preservation
    2. Grammar and fluency
    3. Domain-specific terminology
    4. Translation accuracy

    Return ONLY a valid JSON object with this structure:

    {{
        "quality_score": 85,
        "fluency_rating": "High",
        "terminology_accuracy": "Medium",
        "flagged_issues": [],
        "suggestions": "Your feedback here"
    }}

    quality_score must be an integer between 1 and 100.
    Ratings must be High, Medium, or Low.
    """

    try:
        response = bedrock_runtime.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ],
        )

        raw_output = (
            response["output"]["message"]["content"][0]["text"]
            .strip()
        )

        # Remove Markdown code fences if returned by the model
        if raw_output.startswith("```"):
            raw_output = raw_output.split("\n", 1)[1]
            raw_output = raw_output.rsplit("```", 1)[0].strip()

        data = json.loads(raw_output)

        report = QualityReport(**data)

        return report.model_dump()

    except Exception as error:

        print(f"Translation quality evaluation failed: {error}")

        return {
            "quality_score": 1,
            "fluency_rating": "Low",
            "terminology_accuracy": "Low",
            "flagged_issues": [
                "Automated quality evaluation was unavailable."
            ],
            "suggestions": (
                "Please review the translation manually. "
                "The quality score is not a verified evaluation."
            ),
        }
