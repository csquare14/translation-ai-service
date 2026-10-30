import json
import boto3

bedrock = boto3.client('bedrock-runtime')

def calculate_impact(resource_id: str, resource_graph_nodes: list) -> dict:
    """Calculates potential blast radius and impact using resource graph context[cite: 3, 9, 11, 12]."""
    prompt = f"""
    Analyze the blast radius and potential impact if resource '{resource_id}' is compromised[cite: 3, 9, 12].
    Connected Graph Nodes: {json.dumps(resource_graph_nodes)}
    
    Return strictly a JSON object with keys:
    - "severity": "CRITICAL", "HIGH", "MEDIUM", or "LOW"
    - "affected_components": List of resources impacted downstream
    - "business_impact": Summary of operational or data exposure risk
    """
    
    try:
        response = bedrock.converse(
            modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}]
        )
        return json.loads(response['output']['message']['content'][0]['text'])
    except Exception as e:
        return {
            "severity": "HIGH",
            "affected_components": [resource_id],
            "business_impact": "Potential unauthorized access to interconnected infrastructure."
        }