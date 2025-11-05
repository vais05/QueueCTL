import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'queuectl.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      output TEXT
    );

    CREATE TABLE IF NOT EXISTS dlq (
      id TEXT PRIMARY KEY,
      job_data TEXT NOT NULL,
      moved_at TEXT NOT NULL,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO config (key, value) VALUES ('max_retries', '3');
    INSERT OR IGNORE INTO config (key, value) VALUES ('backoff_base', '2');
    INSERT OR IGNORE INTO config (key, value) VALUES ('backoff_max', '300');
    INSERT OR IGNORE INTO config (key, value) VALUES ('worker_timeout', '300');
  `);
}

export function getDatabase() {
  return db;
}

// Job queries
export function insertJob(job) {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    job.id,
    job.command,
    job.state || 'pending',
    job.attempts || 0,
    job.max_retries || 3,
    job.created_at || new Date().toISOString(),
    job.updated_at || new Date().toISOString()
  );
}

export function getJob(id) {
  const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  return stmt.get(id);
}

export function getAllJobs() {
  const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
  return stmt.all();
}

export function getJobsByState(state) {
  const stmt = db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC');
  return stmt.all(state);
}

export function getJobsToProcess(limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM jobs 
    WHERE state = 'pending' 
    ORDER BY created_at ASC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function updateJobState(id, state) {
  const stmt = db.prepare(`
    UPDATE jobs 
    SET state = ?, updated_at = ?
    WHERE id = ?
  `);
  return stmt.run(state, new Date().toISOString(), id);
}

export function updateJobWithResult(id, result) {
  const stmt = db.prepare(`
    UPDATE jobs 
    SET state = ?, attempts = ?, updated_at = ?, error_message = ?, output = ?, completed_at = ?
    WHERE id = ?
  `);
  return stmt.run(
    result.state,
    result.attempts,
    new Date().toISOString(),
    result.error_message || null,
    result.output || null,
    result.state === 'completed' ? new Date().toISOString() : null,
    id
  );
}

export function updateJobAttempt(id, attempts, errorMessage) {
  const stmt = db.prepare(`
    UPDATE jobs 
    SET attempts = ?, state = ?, updated_at = ?, error_message = ?
    WHERE id = ?
  `);
  return stmt.run(attempts, 'failed', new Date().toISOString(), errorMessage, id);
}

export function moveJobToDLQ(id, reason) {
  const job = getJob(id);
  if (!job) return null;

  const stmt = db.prepare(`
    INSERT INTO dlq (id, job_data, moved_at, reason)
    VALUES (?, ?, ?, ?)
  `);

  const deleteStmt = db.prepare('DELETE FROM jobs WHERE id = ?');

  stmt.run(id, JSON.stringify(job), new Date().toISOString(), reason);
  deleteStmt.run(id);

  return job;
}

export function getDLQJobs() {
  const stmt = db.prepare('SELECT * FROM dlq ORDER BY moved_at DESC');
  return stmt.all();
}

export function getDLQJob(id) {
  const stmt = db.prepare('SELECT * FROM dlq WHERE id = ?');
  return stmt.get(id);
}

export function removeDLQJob(id) {
  const stmt = db.prepare('DELETE FROM dlq WHERE id = ?');
  return stmt.run(id);
}

export function restoreDLQJobToQueue(id) {
  const dlqJob = getDLQJob(id);
  if (!dlqJob) return null;

  const jobData = JSON.parse(dlqJob.job_data);

  // Remove from DLQ
  removeDLQJob(id);

  // Re-insert to pending queue
  insertJob({
    id: jobData.id,
    command: jobData.command,
    state: 'pending',
    attempts: 0,
    max_retries: jobData.max_retries || 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return jobData;
}

// Config queries
export function setConfig(key, value) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value)
    VALUES (?, ?)
  `);
  return stmt.run(key, String(value));
}

export function getConfig(key) {
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  const result = stmt.get(key);
  return result ? result.value : null;
}

export function getAllConfig() {
  const stmt = db.prepare('SELECT key, value FROM config');
  return stmt.all();
}

// Stats queries
export function getQueueStats() {
  const states = ['pending', 'processing', 'completed', 'failed', 'dead'];
  const stats = {};

  states.forEach(state => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE state = ?');
    const result = stmt.get(state);
    stats[state] = result.count;
  });

  const dlqStmt = db.prepare('SELECT COUNT(*) as count FROM dlq');
  stats.dlq = dlqStmt.get().count;

  return stats;
}