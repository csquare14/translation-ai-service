
import boto3

from .classifier import detect_domain
from .evaluator import evaluate_translation
from .glossary import apply_glossary
from .translation_memory import (
    initialize_database,
    find_translation,
    find_translation_auto,
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
    if source_lang == "auto":

        cached_result = find_translation_auto(
            text,
            target_lang,
            domain
        )

        if cached_result:
            translated_text, detected_source = cached_result
            translation_source = "Translation Memory"
            print("Previous translation found. Reusing it.")

    else:

        translated_text = find_translation(
            text,
            source_lang,
            target_lang,
            domain
        )

        if translated_text:
            detected_source = source_lang
            translation_source = "Translation Memory"
            print("Previous translation found. Reusing it.")

    # Step 4: If no match, use Amazon Translate
    if translated_text is None:

        translate_kwargs = {
            "Text": text,
            "SourceLanguageCode": source_lang,
            "TargetLanguageCode": target_lang
        }

        # Use AWS-managed terminology if configured
        if domain != "General":
            translate_kwargs["TerminologyNames"] = [
                f"{domain}_Glossary"
            ]

        translate_response = translate_client.translate_text(
            **translate_kwargs
        )

        translated_text = translate_response["TranslatedText"]
        detected_source = translate_response["SourceLanguageCode"]

    # Step 5: Apply local domain glossary
    translated_text = apply_glossary(
        translated_text,
        domain,
        target_lang
    )

    # Step 6: Save new translation after glossary application
    if translation_source == "Amazon Translate":

        save_translation(
            text,
            translated_text,
            detected_source,
            target_lang,
            domain
        )

    # Step 7: Evaluate translation quality
    quality_report = evaluate_translation(
        text,
        translated_text,
        domain
    )

    # Step 8: Return final result
    return {
        "source_language": detected_source,
        "target_language": target_lang,
        "detected_domain": domain,
        "translated_text": translated_text,
        "translation_source": translation_source,
        "quality_report": quality_report
    }
