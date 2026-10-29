from ai_core.pipeline import process_translation_pipeline

if __name__ == "__main__":
    sample_text = "The patient presents with severe acute myocardial infarction and requires immediate administration of tissue plasminogen activator."
    
    print("Running AI Pipeline Test...\n")
    result = process_translation_pipeline(sample_text, source_lang="en", target_lang="es")
    
    import json
    print(json.dumps(result, indent=2))