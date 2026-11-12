
from unittest.mock import patch

from ai_core.pipeline import process_translation_pipeline


TEST_CASES = [
    ("Medical", "Treatment", "Traitement"),
    ("Legal", "Agreement", "Contrat"),
    ("Finance", "Revenue", "Revenu"),
    ("IT_Software", "Database", "Base de données"),
]


def test_domain_glossary(domain, term, expected):

    source_text = f"The {term} is important."
    mock_translation = f"The {term} is important."
    expected_translation = f"The {expected} is important."

    with patch(
        "ai_core.pipeline.detect_domain",
        return_value=domain
    ), patch(
        "ai_core.pipeline.initialize_database"
    ), patch(
        "ai_core.pipeline.find_translation",
        return_value=None
    ), patch(
        "ai_core.pipeline.translate_client.translate_text",
        return_value={
            "TranslatedText": mock_translation,
            "SourceLanguageCode": "en"
        }
    ) as mock_translate, patch(
        "ai_core.pipeline.save_translation"
    ) as mock_save, patch(
        "ai_core.pipeline.evaluate_translation",
        return_value={"score": 95, "status": "Good"}
    ) as mock_evaluator:

        result = process_translation_pipeline(
            source_text,
            source_lang="en",
            target_lang="fr"
        )

        assert result["detected_domain"] == domain
        assert result["translated_text"] == expected_translation

        mock_translate.assert_called_once()

        mock_save.assert_called_once_with(
            source_text,
            expected_translation,
            "en",
            "fr",
            domain
        )

        mock_evaluator.assert_called_once_with(
            source_text,
            expected_translation,
            domain
        )

        print(f"PASSED: {domain}")
        print(f"  {term} -> {expected}")
        print(f"  Final: {result['translated_text']}")


if __name__ == "__main__":

    for domain, term, expected in TEST_CASES:
        test_domain_glossary(domain, term, expected)

    print("\nALL FOUR DOMAIN GLOSSARY TESTS PASSED!")
