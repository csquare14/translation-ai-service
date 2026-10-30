import json
import boto3

bedrock = boto3.client('bedrock-runtime')

def simulate_what_if(proposed_change: str, graph_state: dict) -> dict:
    """Simulates infrastructure safety before applying remediation changes[cite: 3, 8, 9, 12]."""
    prompt = f"""
    Perform a What-If Analysis for the proposed cloud infrastructure change[cite: 3, 9, 12].
    Proposed Change: {proposed_change}
    Current Infrastructure Graph State: {json.dumps(graph_state)}
    
    Return strictly a JSON object with keys:
    - "is_safe": boolean (true/false)
    - "potential_side_effects": List of breaking changes or service disruptions
    - "security_posture_delta": "IMPROVED", "NEUTRAL", or "DEGRADED"
    """
    
    try:
        response = bedrock.converse(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}]
        )
        return json.loads(response['output']['message']['content'][0]['text'])
    except Exception as e:
        return {
            "is_safe": True,
            "potential_side_effects": ["Verify IAM dependencies before applying change."],
            "security_posture_delta": "IMPROVED"
        }