import json
import boto3

bedrock = boto3.client('bedrock-runtime')

def detect_domain(text: str) -> str:
    """Detects domain using Amazon Bedrock (Claude / Nova)."""
    prompt = f"""
    Analyze the following text and classify its primary domain into ONE of these exact terms:
    [Legal, Medical, IT_Software, Finance, General].
    Respond ONLY with the category name and nothing else.

    Text: {text[:500]}
    """
    
    # Bedrock Converse API invocation
    try:
        response = bedrock.converse(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",  # or Amazon Nova Micro
            messages=[{"role": "user", "content": [{"text": prompt}]}]
        )
        domain = response['output']['message']['content'][0]['text'].strip()
        return domain if domain in ["Legal", "Medical", "IT_Software", "Finance"] else "General"
    except Exception as e:
        print(f"Domain detection fallback to General: {e}")
        return "General"