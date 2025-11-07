import {
  getJob,
  getJobsToProcess,
  updateJobState,
  updateJobWithResult,
  updateJobAttempt,
  moveJobToDLQ,
  getConfig,
  getJobsByState as dbGetJobsByState,   
  resetJobAttempts,
  getJobCountsByState,
  getActiveWorkersCount,
  processNextJob
} from './db.js';

export async function getNextJob() {
  const jobs = await getJobsToProcess(1);
  return jobs.length > 0 ? jobs[0] : null;
}
export async function startProcessing(jobId) {
  await updateJobState(jobId, 'processing');
}

export async function completeJob(jobId, output) {
  const job = await getJob(jobId);
  await updateJobWithResult(jobId, {
    state: 'completed',
    attempts: job.attempts,
    output,
  });
}


export async function failJob(jobId, error) {
  const job = await getJob(jobId);
  const nextAttempt = (job.attempts || 0) + 1;
  const maxRetries = job.max_retries || 3;

  if (nextAttempt < maxRetries) {
    await updateJobAttempt(jobId, nextAttempt, error, 'pending');
  } else {
    await updateJobWithResult(jobId, {
      state: 'failed',
      attempts: nextAttempt,
      error_message: error
    });
  }
}


export async function getBackoffDelay(attempts) {
  const backoffBase = parseInt(await getConfig('backoff_base')) || 2;
  const backoffMax = parseInt(await getConfig('backoff_max')) || 300;

  const delay = Math.pow(backoffBase, attempts);
  return Math.min(delay, backoffMax);
}

export function shouldRetry(job) {
  const maxRetries = job.max_retries || 3;
  return job.attempts < maxRetries;
}

/**
 * @param {string} state 
 * @returns {Array} 
 */
export function getJobsByState(state) {
  return dbGetJobsByState(state);
}

/**
 *
 * @param {string} jobId
 */
export async function retryDeadJob(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error('Job not found');
  if (job.state !== 'dead') throw new Error('Job not in dead state');

  await updateJobState(jobId, 'pending');
  await resetJobAttempts(jobId);
}

/**
 * 
 * @returns {Object} {pending: n, processing: m, completed: x, failed: y, dead: z, activeWorkers: w}
 */
export async function getJobStatus() {
  const counts = await getJobCountsByState();
  const activeWorkers = await getActiveWorkersCount();
  return {
    ...counts,
    activeWorkers,
  };
}