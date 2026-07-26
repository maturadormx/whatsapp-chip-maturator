CREATE TABLE IF NOT EXISTS behavior_budget_reservations (
  id VARCHAR(64) PRIMARY KEY,
  executionId VARCHAR(64) NOT NULL,
  attempt INT NOT NULL,
  userId INT NOT NULL,
  amount INT NOT NULL,
  status ENUM('RESERVED', 'COMMITTED', 'RELEASED') NOT NULL DEFAULT 'RESERVED',
  reason TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committedAt TIMESTAMP NULL,
  releasedAt TIMESTAMP NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_behavior_budget_execution_attempt (executionId, attempt),
  KEY ix_behavior_budget_user_status_created (userId, status, createdAt)
);
