import streamlit as st
from botocore.exceptions import BotoCoreError, ClientError

from ai_core.pipeline import process_translation_pipeline

st.set_page_config(
    page_title="AI Translation Service",
    page_icon="🌐",
    layout="wide",
)

st.title("🌐 AI-Powered Translation Service")
st.write(
    "Translate text using Amazon Translate with domain detection "
    "and translation quality evaluation."
)

col1, col2 = st.columns(2)

with col1:
    source_lang = st.selectbox(
        "Source language",
        options=["auto", "en", "es", "fr", "de", "hi", "ta", "zh", "ja"],
        format_func=lambda x: {
            "auto": "Auto-detect",
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "hi": "Hindi",
            "ta": "Tamil",
            "zh": "Chinese",
            "ja": "Japanese",
        }.get(x, x),
    )

with col2:
    target_lang = st.selectbox(
        "Target language",
        options=["en", "es", "fr", "de", "hi", "ta", "zh", "ja"],
        format_func=lambda x: {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "hi": "Hindi",
            "ta": "Tamil",
            "zh": "Chinese",
            "ja": "Japanese",
        }.get(x, x),
        index=1,
    )

text_input = st.text_area(
    "Enter text to translate",
    height=180,
    placeholder="Type or paste your text here...",
)

if st.button("Translate", type="primary", use_container_width=True):
    if not text_input.strip():
        st.warning("Please enter some text first.")
    elif source_lang != "auto" and source_lang == target_lang:
        st.warning("Choose different source and target languages.")
    else:
        try:
            with st.spinner("Translating and evaluating quality..."):
                result = process_translation_pipeline(
                    text=text_input.strip(),
                    source_lang=source_lang,
                    target_lang=target_lang,
                )

            st.subheader("Translation")
            st.text_area(
                "Translated text",
                value=result.get("translated_text", ""),
                height=180,
            )

            st.subheader("Translation details")
            st.write(
                "**Detected source language:**",
                result.get("source_language", "Unknown"),
            )
            st.write(
                "**Target language:**",
                result.get("target_language", target_lang),
            )
            st.write(
                "**Detected domain:**",
                result.get("detected_domain", "Unknown"),
            )

            st.subheader("Quality evaluation")
            st.json(result.get("quality_report", {}))

        except (ClientError, BotoCoreError) as error:
            st.error(
                "AWS request failed. Check your AWS credentials, region, "
                "permissions, and any required translation terminology."
            )
            st.code(str(error))

        except Exception as error:
            st.error("The translation pipeline encountered an error.")
            st.code(f"{type(error).__name__}: {error}")
