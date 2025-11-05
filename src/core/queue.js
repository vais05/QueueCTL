import {
    getJob,
    getJobsToProcess,
    updateJobState,
    updateJobWithResult,
    updateJobAttempt,
    moveJobToDLQ,
    getConfig,
  } from './db.js';
  
  export function getNextJob() {
    const jobs = getJobsToProcess(1);
    return jobs.length > 0 ? jobs[0] : null;
  }
  
  export function startProcessing(jobId) {
    updateJobState(jobId, 'processing');
  }
  
  export function completeJob(jobId, output) {
    updateJobWithResult(jobId, {
      state: 'completed',
      attempts: getJob(jobId).attempts + 1,
      output,
    });
  }
  
  export function failJob(jobId, error) {
    const job = getJob(jobId);
    const nextAttempt = (job.attempts || 0) + 1;
    const maxRetries = job.max_retries || 3;
  
    if (nextAttempt > maxRetries) {
      moveJobToDLQ(jobId, `Failed after ${maxRetries} retries: ${error}`);
    } else {
      updateJobAttempt(jobId, nextAttempt, error);
    }
  }
  
  export function getBackoffDelay(attempts) {
    const backoffBase = parseInt(getConfig('backoff_base')) || 2;
    const backoffMax = parseInt(getConfig('backoff_max')) || 300;
  
    const delay = Math.pow(backoffBase, attempts);
    return Math.min(delay, backoffMax);
  }
  
  export function shouldRetry(job) {
    const maxRetries = job.max_retries || 3;
    return job.attempts < maxRetries;
  }