ALTER TABLE behavior_action_execution
MODIFY COLUMN status ENUM('PENDING', 'SENDING', 'ACKED', 'FAILED', 'RETRYING') NOT NULL DEFAULT 'PENDING';

ALTER TABLE behavior_action_execution
ADD COLUMN IF NOT EXISTS recoverable INT NOT NULL DEFAULT 1 AFTER attempt;

ALTER TABLE behavior_action_execution
ADD COLUMN IF NOT EXISTS maxAttempts INT NOT NULL DEFAULT 3 AFTER recoverable;

ALTER TABLE behavior_action_execution
ADD COLUMN IF NOT EXISTS nextRetryAt TIMESTAMP NULL AFTER maxAttempts;

ALTER TABLE behavior_action_execution
ADD COLUMN IF NOT EXISTS lastRetryAt TIMESTAMP NULL AFTER nextRetryAt;
