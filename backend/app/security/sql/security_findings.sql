CREATE TABLE IF NOT EXISTS security_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT,
    detected_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_findings_rule_id
ON security_findings(rule_id);

CREATE INDEX IF NOT EXISTS idx_security_findings_severity
ON security_findings(severity);

CREATE INDEX IF NOT EXISTS idx_security_findings_created_at
ON security_findings(created_at);
