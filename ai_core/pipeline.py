import boto3
from .classifier import detect_domain
from .evaluator import evaluate_translation

translate_client = boto3.client('translate')

def process_translation_pipeline(text: str, source_lang: str = "auto", target_lang: str = "en") -> dict:
    # Step 1: Pre-Processing (Domain Classifier)
    domain = detect_domain(text)
    
    # Step 2: Translation Core (Amazon Translate + Terminology Lock)
    translate_kwargs = {
        "Text": text,
        "SourceLanguageCode": source_lang,
        "TargetLanguageCode": target_lang
    }
    
    # If a custom terminology exists in AWS for this domain, apply it
    if domain != "General":
        translate_kwargs["TerminologyNames"] = [f"{domain}_Glossary"]

    translate_response = translate_client.translate_text(**translate_kwargs)
    translated_text = translate_response['TranslatedText']
    detected_source = translate_response['SourceLanguageCode']

    # Step 3: Post-Processing (LLM Quality Evaluation)
    quality_report = evaluate_translation(text, translated_text, domain)

    # Step 4: Construct Return Object for Backend/Lambda Integration
    return {
        "source_language": detected_source,
        "target_language": target_lang,
        "detected_domain": domain,
        "translated_text": translated_text,
        "quality_report": quality_report
    }