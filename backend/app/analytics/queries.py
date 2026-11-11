TOTAL_JOBS_QUERY = """
SELECT COUNT(*) AS total_jobs
FROM translation_jobs;
"""

COMPLETED_JOBS_QUERY = """
SELECT COUNT(*) AS completed_jobs
FROM translation_jobs
WHERE status = 'completed';
"""

FAILED_JOBS_QUERY = """
SELECT COUNT(*) AS failed_jobs
FROM translation_jobs
WHERE status = 'failed';
"""

LANGUAGE_USAGE_QUERY = """
SELECT target_language, COUNT(*) AS total
FROM translation_jobs
GROUP BY target_language
ORDER BY total DESC;
"""

DAILY_USAGE_QUERY = """
SELECT DATE(created_at) AS date, COUNT(*) AS total
FROM translation_jobs
GROUP BY DATE(created_at)
ORDER BY date DESC;
"""