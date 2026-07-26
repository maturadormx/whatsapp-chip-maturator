ALTER TABLE behavior_decision_log
ADD COLUMN IF NOT EXISTS policyFingerprint VARCHAR(128) NULL AFTER engineVersion;

ALTER TABLE behavior_snapshots
ADD COLUMN IF NOT EXISTS policyFingerprint VARCHAR(128) NULL AFTER engineVersion;
