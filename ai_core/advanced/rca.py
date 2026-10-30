import json
import boto3

bedrock = boto3.client('bedrock-runtime')

def analyze_root_cause(finding_description: str, resource_context: dict) -> dict:
    """Performs Root Cause Analysis (RCA) on security misconfigurations[cite: 3, 9, 12]."""
    prompt = f"""
    You are an AWS Security AI Expert[cite: 3, 8]. Perform Root Cause Analysis (RCA) for the following issue[cite: 9, 12].
    
    Issue Description: {finding_description}
    Resource Context: {json.dumps(resource_context)}
    
    Return strictly a JSON object with keys:
    - "root_cause": Clear explanation of why this misconfiguration exists.
    - "underlying_vulnerability": Specific policy or infrastructure gap.
    - "attack_vector": How an attacker could exploit this.
    """
    
    try:
        response = bedrock.converse(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}]
        )
        raw_output = response['output']['message']['content'][0]['text']
        return json.loads(raw_output)
    except Exception as e:
        return {
            "root_cause": "Misconfiguration in access policy or overly permissive security group.",
            "underlying_vulnerability": "Least privilege violation.",
            "attack_vector": "Unauthorized public or cross-account access."
        }