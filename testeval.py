
from ai_core.evaluator import evaluate_translation

source = "Hello, how are you?"
translated = "Hola, ¿cómo estás?"

print("Testing Bedrock translation quality evaluation...")

result = evaluate_translation(
    source_text=source,
    translated_text=translated,
    domain="General",
)

print("\nQuality evaluation result:")
print(result)
