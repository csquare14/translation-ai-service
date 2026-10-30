import json
import boto3

bedrock = boto3.client('bedrock-runtime')

def generate_remediation_plan(finding: str, resource_type: str) -> dict:
    """Generates step-by-step remediation plans and Terraform/AWS CLI fixes[cite: 3, 8, 9, 12]."""
    prompt = f"""
    Provide actionable remediation steps for the finding: '{finding}' on AWS resource type '{resource_type}'[cite: 3, 8, 9, 12].
    
    Return strictly a JSON object with keys:
    - "steps": List of manual UI steps
    - "aws_cli_command": Complete CLI command to fix the issue
    - "terraform_snippet": Example HCL configuration for code remediation
    """
    
    try:
        response = bedrock.converse(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}]
        )
        return json.loads(response['output']['message']['content'][0]['text'])
    except Exception as e:
        return {
            "steps": ["Navigate to AWS Console", "Update Resource Policy"],
            "aws_cli_command": "# aws ec2/s3 update command",
            "terraform_snippet": "# terraform resource update"
        }