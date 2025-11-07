import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'queuectl.db');
console.log('Using database file:', dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

async function initDb() {
  if (!db) {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    await db.exec(`PRAGMA journal_mode = WAL;`);
  }
  return db;
}
export async function initializeDatabase() {
  const db = await getDatabase(); 
  await db.exec(`
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

  await initializeActiveWorkersTable();
}

export async function getDatabase() {
  return await initDb();
}
export async function processNextJob() {
  const db = await getDatabase();
  
  try {
    await db.run('BEGIN IMMEDIATE');
    const job = await db.get(
      "SELECT * FROM jobs WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1"
    );
    
    if (!job) {
      await db.run('COMMIT');
      return null;
    }
    
    const currentAttempts = job.attempts ?? 0;
    const newAttempts = currentAttempts + 1;
    
    await db.run(
      `UPDATE jobs 
       SET state = ?, 
           attempts = ?,
           started_at = ?,
           updated_at = ?
       WHERE id = ?`,
      'processing',
      newAttempts,
      new Date().toISOString(),
      new Date().toISOString(),
      job.id
    );
    
    await db.run('COMMIT');
    
    return {
      ...job,
      state: 'processing',
      attempts: newAttempts,
      started_at: new Date().toISOString()
    };
    
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackError) {
    }
    console.error('Error in processNextJob:', error);
    throw error;
  }
}

export async function insertJob(job) {
  const db = await getDatabase();

  return db.run(
    `
    INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    job.id,
    job.command,
    job.state || 'pending',
    job.attempts || 0,
    job.max_retries || 3,
    job.created_at || new Date().toISOString(),
    job.updated_at || new Date().toISOString()
  );
}


export async function getJob(id) {
  const db = await initDb();
  return db.get('SELECT * FROM jobs WHERE id = ?', id);
}

export async function getAllJobs() {
  const db = await initDb();
  return db.all('SELECT * FROM jobs ORDER BY created_at DESC');
}

export async function getJobsByState(state) {
  const db = await initDb();
  return db.all('SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC', state);
}

export async function getJobsToProcess(limit = 10) {
  const db = await initDb();
  return db.all(
    `SELECT * FROM jobs 
     WHERE state = 'pending' 
     ORDER BY created_at ASC 
     LIMIT ?`,
    limit
  );
}


export async function updateJobState(id, state) {
  const db = await getDatabase();
  return db.run(
    `
    UPDATE jobs 
    SET state = ?, updated_at = ?
    WHERE id = ?
    `,
    state,
    new Date().toISOString(),
    id
  );
}
export async function updateJobWithResult(id, result) {
  const db = await getDatabase();
  const currentJob = await getJob(id);
  
  await db.run(
    `UPDATE jobs 
     SET state = ?, 
         attempts = ?,
         updated_at = ?, 
         error_message = ?, 
         output = ?, 
         completed_at = ?
     WHERE id = ?`,
    result.state,
    result.attempts !== undefined ? result.attempts : currentJob.attempts, 
    new Date().toISOString(),
    result.error_message || null,
    result.output || null,
    result.state === 'completed' ? new Date().toISOString() : null,
    id
  );
}


export async function updateJobAttempt(id, attempts, errorMessage, state = 'failed') {
  const db = await getDatabase();
  return db.run(
    `UPDATE jobs 
     SET attempts = ?, 
         state = ?, 
         updated_at = ?, 
         error_message = ?
     WHERE id = ?`,
    attempts,
    state,
    new Date().toISOString(),
    errorMessage,
    id
  );
}


export async function moveJobToDLQ(id, reason) {
  const db = await getDatabase();

  const job = await getJob(id); 
  if (!job) return null;

  await db.run(
    `
    INSERT INTO dlq (id, job_data, moved_at, reason)
    VALUES (?, ?, ?, ?)
    `,
    id,
    JSON.stringify(job),
    new Date().toISOString(),
    reason
  );

  await db.run('DELETE FROM jobs WHERE id = ?', id);

  return job;
}


export async function getDLQJobs() {
  const db = await initDb();
  return db.all('SELECT * FROM dlq ORDER BY moved_at DESC');
}


export async function getDLQJob(id) {
  const db = await initDb();
  return db.get('SELECT * FROM dlq WHERE id = ?', id);
}


export async function removeDLQJob(id) {
  const db = await getDatabase();
  return db.run('DELETE FROM dlq WHERE id = ?', id);
}


export async function restoreDLQJobToQueue(id) {
  const db = await getDatabase();
  const dlqJob = await getDLQJob(id);
  if (!dlqJob) return null;

  const jobData = JSON.parse(dlqJob.job_data);

  await removeDLQJob(id);

  await insertJob({
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

export async function setConfig(key, value) {
  const db = await getDatabase();
  return db.run(
    `
    INSERT OR REPLACE INTO config (key, value)
    VALUES (?, ?)
    `,
    key,
    String(value)
  );
}

export async function getConfig(key) {
  const db = await getDatabase();
  const result = await db.get('SELECT value FROM config WHERE key = ?', key);
  return result ? result.value : null;
}

export async function getAllConfig() {
  const db = await initDb();
  return db.all('SELECT key, value FROM config');
}



export async function initializeActiveWorkersTable() {
  const db = await getDatabase();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS active_workers (
      worker_id TEXT PRIMARY KEY,
      last_heartbeat TEXT NOT NULL
    )
  `);
}

export async function updateWorkerHeartbeat(workerId) {
  const db = await getDatabase();
  return db.run(
    `
    INSERT INTO active_workers (worker_id, last_heartbeat)
    VALUES (?, ?)
    ON CONFLICT(worker_id)
    DO UPDATE SET last_heartbeat = excluded.last_heartbeat
    `,
    workerId,
    new Date().toISOString()
  );
}


export async function removeWorker(workerId) {
  const db = await getDatabase();
  return db.run('DELETE FROM active_workers WHERE worker_id = ?', workerId);
}


export async function getActiveWorkersCount() {
  const db = await initDb();
  const result = await db.get(`
    SELECT COUNT(*) as count FROM active_workers 
    WHERE last_heartbeat >= datetime('now', '-1 minute')
  `);
  return result ? result.count : 0;
}


export async function getNextJob() {
  const db = await getDatabase();
  const job = await db.get(
    "SELECT * FROM jobs WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1"
  );
  return job || null;
}

export async function getJobCountsByState() {
  const db = await getDatabase();
  const states = ['pending', 'processing', 'completed', 'failed', 'dead'];
  const stats = {};

  for (const state of states) {
    const res = await db.get('SELECT COUNT(*) as count FROM jobs WHERE state = ?', state);
    stats[state] = res.count;
  }

  const dlqRes = await db.get('SELECT COUNT(*) as count FROM dlq');
  stats.dlq = dlqRes.count;

  stats.active_workers = await getActiveWorkersCount();

  return stats;
}


export async function resetJobAttempts(jobId) {
  const db = await getDatabase();
  return db.run(
    `
    UPDATE jobs
    SET attempts = 0, error_message = NULL, updated_at = ?
    WHERE id = ?
    `,
    new Date().toISOString(),
    jobId
  );
}
