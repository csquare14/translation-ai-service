import logging
import threading

from botocore.exceptions import ClientError


logger = logging.getLogger(__name__)


def run_translation(text, source_language, target_language):
    from ai_core.pipeline import process_translation_pipeline

    return process_translation_pipeline(text, source_language, target_language)


def describe_failure(error):
    code = type(error).__name__
    retryable = False
    message = "Translation failed. Check the input and service configuration, then retry."
    if isinstance(error, ClientError):
        code = error.response.get("Error", {}).get("Code", code)
        retryable = code in {
            "ThrottlingException", "TooManyRequestsException", "InternalServerException",
            "ServiceUnavailableException", "RequestTimeout",
        }
        if code == "AccessDeniedException":
            message = "AWS permission is missing. Check Translate and Comprehend access."
        elif code == "TextSizeLimitExceededException":
            message = "The input exceeds the translation service's text limit."
    elif isinstance(error, (TimeoutError, ConnectionError)) or code in {
        "ReadTimeout", "ConnectTimeout", "ReadTimeoutError", "EndpointConnectionError",
    }:
        retryable = True
        message = "A translation service timed out or could not be reached."
    elif getattr(error, "code", None) in {429, 500, 502, 503, 504}:
        retryable = True
        message = "The AI service is temporarily busy or unavailable."
    return {"code": code, "message": message}, retryable


class JobWorker:
    def __init__(self, store, translate=run_translation):
        self.store = store
        self.translate = translate
        self.stop_event = threading.Event()
        self.wake_event = threading.Event()
        self.thread = None

    def start(self):
        self.store.initialize()
        self.store.recover_interrupted()
        self.thread = threading.Thread(target=self.run, name="translation-worker", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.wake_event.set()
        if self.thread:
            self.thread.join(timeout=5)

    def wake(self):
        self.wake_event.set()

    def process_one(self):
        job = self.store.claim_next()
        if job is None:
            return False
        try:
            result = self.translate(
                job["source_text"], job["source_language"], job["target_language"]
            )
            self.store.complete(job["job_id"], result)
        except Exception as error:
            public_error, retryable = describe_failure(error)
            delay = 2 ** job["attempt_count"] if retryable and job["attempt_count"] < 3 else None
            self.store.fail(job["job_id"], public_error, retry_delay=delay)
            logger.warning("Job %s failed (%s)", job["job_id"], public_error["code"])
        return True

    def run(self):
        while not self.stop_event.is_set():
            try:
                if self.process_one():
                    continue
            except Exception:
                logger.exception("Local job worker could not access the job store")
            self.wake_event.wait(timeout=1)
            self.wake_event.clear()
