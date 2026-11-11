
import boto3

from .classifier import detect_domain
from .evaluator import evaluate_translation
from .translation_memory import (
    initialize_database,
    find_translation,
    save_translation,
)

translate_client = boto3.client("translate")


def process_translation_pipeline(
    text: str,
    source_lang: str = "auto",
    target_lang: str = "en"
) -> dict:

    # Step 1: Detect the document domain
    domain = detect_domain(text)

    # Step 2: Initialize Translation Memory database
    initialize_database()

    translated_text = None
    detected_source = source_lang
    translation_source = "Amazon Translate"

    # Step 3: Check Translation Memory
    # Exact lookup is possible when source language is selected.
    if source_lang != "auto":
        translated_text = find_translation(
            text,
            source_lang,
            target_lang,
            domain
        )

        if translated_text:
            translation_source = "Translation Memory"
            print("Previous translation found. Reusing it.")

    # Step 4: If no match, use Amazon Translate
    if translated_text is None:

        translate_kwargs = {
            "Text": text,
            "SourceLanguageCode": source_lang,
            "TargetLanguageCode": target_lang
        }

        if domain != "General":
            translate_kwargs["TerminologyNames"] = [
                f"{domain}_Glossary"
            ]

        translate_response = translate_client.translate_text(
            **translate_kwargs
        )

        translated_text = translate_response["TranslatedText"]
        detected_source = translate_response["SourceLanguageCode"]

        # Step 5: Save the new translation
        save_translation(
            text,
            translated_text,
            detected_source,
            target_lang,
            domain
        )

    # Step 6: Evaluate translation quality
    quality_report = evaluate_translation(
        text,
        translated_text,
        domain
    )

    # Step 7: Return result
    return {
        "source_language": detected_source,
        "target_language": target_lang,
        "detected_domain": domain,
        "translated_text": translated_text,
        "translation_source": translation_source,
        "quality_report": quality_report
    }
