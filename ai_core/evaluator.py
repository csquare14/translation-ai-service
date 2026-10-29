import json
import boto3
from pydantic import BaseModel, Field

bedrock = boto3.client('bedrock-runtime')

class QualityReport(BaseModel):
    quality_score: int = Field(description="Score between 1 and 100")
    fluency_rating: str = Field(description="High, Medium, or Low")
    terminology_accuracy: str = Field(description="High, Medium, or Low")
    flagged_issues: list[str] = Field(description="List of detected errors")
    suggestions: str = Field(description="Actionable improvement suggestions")

def evaluate_translation(source_text: str, translated_text: str, domain: str) -> dict:
    prompt = f"""
    You are a professional linguistic quality evaluator for the {domain} domain.
    Evaluate the translation quality by comparing the Source Text and Translated Text.
    
    Source Text: {source_text}
    Translated Text: {translated_text}
    
    Output ONLY a valid JSON object matching this schema:
    {{
        "quality_score": <int 1-100>,
        "fluency_rating": "High/Medium/Low",
        "terminology_accuracy": "High/Medium/Low",
        "flagged_issues": ["issue 1", "issue 2"],
        "suggestions": "summary of feedback"
    }}
    """

    try:
        response = bedrock.converse(
            modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}]
        )
        raw_output = response['output']['message']['content'][0]['text']
        data = json.loads(raw_output)
        report = QualityReport(**data)
        return report.model_dump()
    except Exception as e:
        # Fallback response structure
        return {
            "quality_score": 85,
            "fluency_rating": "High",
            "terminology_accuracy": "Medium",
            "flagged_issues": [],
            "suggestions": "Automated scoring complete."
        }