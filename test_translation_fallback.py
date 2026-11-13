import unittest
import warnings
from unittest.mock import patch

from botocore.exceptions import ClientError

from ai_core.gemini_translation import TranslationResult, translate_with_gemini
from ai_core.pipeline import process_translation_pipeline


def aws_error(code):
    return ClientError({"Error": {"Code": code, "Message": "test error"}}, "TranslateText")


class TranslationFallbackTests(unittest.TestCase):
    def setUp(self):
        self.mocks = {}
        replacements = {
            "detect_domain": "General",
            "initialize_database": None,
            "find_translation": None,
            "find_translation_auto": None,
            "save_translation": None,
            "evaluate_translation": {"quality_score": 95},
            "translate_client.translate_text": {
                "TranslatedText": "Hola", "SourceLanguageCode": "en"
            },
            "translate_with_gemini": TranslationResult(
                source_language="la", translated_text="Hola, amigo."
            ),
        }
        for name, value in replacements.items():
            patcher = patch(f"ai_core.pipeline.{name}", return_value=value)
            self.mocks[name] = patcher.start()
            self.addCleanup(patcher.stop)

    def test_auto_latin_fallback_is_evaluated_and_cached(self):
        self.mocks["translate_client.translate_text"].side_effect = aws_error(
            "UnsupportedLanguagePairException"
        )
        result = process_translation_pipeline("Salve, amice.", "auto", "es")
        self.assertEqual(result["translation_source"], "Gemini")
        self.assertEqual(result["source_language"], "la")
        self.mocks["translate_with_gemini"].assert_called_once_with(
            "Salve, amice.", "auto", "es", "General"
        )
        self.mocks["save_translation"].assert_called_once_with(
            "Salve, amice.", "Hola, amigo.", "la", "es", "General"
        )
        self.mocks["evaluate_translation"].assert_called_once_with(
            "Salve, amice.", "Hola, amigo.", "General"
        )

    def test_supported_pair_uses_amazon(self):
        result = process_translation_pipeline("Hello", "en", "es")
        self.assertEqual(result["translation_source"], "Amazon Translate")
        self.mocks["translate_with_gemini"].assert_not_called()

    def test_permission_error_is_not_hidden(self):
        self.mocks["translate_client.translate_text"].side_effect = aws_error("AccessDeniedException")
        with self.assertRaises(ClientError):
            process_translation_pipeline("Salve", "la", "es")
        self.mocks["translate_with_gemini"].assert_not_called()
        self.mocks["save_translation"].assert_not_called()

    def test_fallback_after_missing_terminology(self):
        self.mocks["detect_domain"].return_value = "Medical"
        self.mocks["translate_client.translate_text"].side_effect = [
            aws_error("ResourceNotFoundException"),
            aws_error("UnsupportedLanguagePairException"),
        ]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            result = process_translation_pipeline("Salve", "la", "es")
        self.assertEqual(result["translation_source"], "Gemini")

    def test_cached_translation_does_not_call_either_translator(self):
        self.mocks["find_translation_auto"].return_value = ("Hola", "la")
        result = process_translation_pipeline("Salve", "auto", "es")
        self.assertEqual(result["translation_source"], "Translation Memory")
        self.mocks["translate_client.translate_text"].assert_not_called()
        self.mocks["translate_with_gemini"].assert_not_called()

    def test_gemini_failure_does_not_cache_a_translation(self):
        self.mocks["translate_client.translate_text"].side_effect = aws_error(
            "UnsupportedLanguagePairException"
        )
        self.mocks["translate_with_gemini"].side_effect = RuntimeError("unavailable")
        with self.assertRaises(RuntimeError):
            process_translation_pipeline("Salve", "la", "es")
        self.mocks["save_translation"].assert_not_called()


class GeminiTranslationTests(unittest.TestCase):
    def test_whitespace_translation_is_rejected(self):
        with patch("ai_core.gemini_translation.generate_structured_response") as generate:
            generate.return_value = TranslationResult(source_language="la", translated_text="   ")
            with self.assertRaises(ValueError):
                translate_with_gemini("Salve", "la", "es", "General")


if __name__ == "__main__":
    unittest.main()
