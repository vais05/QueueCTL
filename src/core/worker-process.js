import { spawn } from 'child_process';
import {
  getNextJob,
  startProcessing,
  completeJob,
  failJob,
  getBackoffDelay,
} from './queue.js';
import { getDatabase, getJob, updateJobState } from './db.js';
import { acquireLock, releaseLock, isLocked } from './lock.js';
import chalk from 'chalk';

const db = getDatabase();

export async function processNextJob(workerId) {
  let job = getNextJob();
  if (!job) {
    return null;
  }

  // Try to acquire lock
  if (!acquireLock(job.id)) {
    // Another worker took this job
    return null;
  }

  try {
    // Verify job is still pending (double-check)
    const freshJob = getJob(job.id);
    if (freshJob.state !== 'pending') {
      releaseLock(job.id);
      return null;
    }

    startProcessing(job.id);
    console.log(chalk.blue(`[Worker ${workerId}] Starting job: ${job.id}`));

    // Calculate backoff if this is a retry
    if (freshJob.attempts > 0) {
      const backoffDelay = getBackoffDelay(freshJob.attempts);
      console.log(chalk.gray(`[Worker ${workerId}] Backoff delay: ${backoffDelay}s for retry attempt ${freshJob.attempts + 1}`));
      await sleep(backoffDelay * 1000);
    }

    const result = await executeCommand(job.command);

    if (result.success) {
      completeJob(job.id, result.output);
      console.log(chalk.green(`[Worker ${workerId}] ✓ Job completed: ${job.id}`));
    } else {
      failJob(job.id, result.error);
      console.log(chalk.yellow(`[Worker ${workerId}] ✗ Job failed: ${job.id}`));
    }

    return result;
  } catch (error) {
    failJob(job.id, error.message);
    console.error(chalk.red(`[Worker ${workerId}] Error processing job: ${error.message}`));
    return null;
  } finally {
    releaseLock(job.id);
  }
}

export function executeCommand(command) {
  return new Promise((resolve) => {
    const timeout = parseInt(process.env.WORKER_TIMEOUT) || 300000; // 5 minutes default

    const child = spawn('bash', ['-c', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        success: false,
        error: `Command timeout after ${timeout}ms`,
      });
    }, timeout);

    child.on('exit', (code) => {
      clearTimeout(timeoutHandle);
      if (code === 0) {
        resolve({
          success: true,
          output,
        });
      } else {
        resolve({
          success: false,
          error: error || `Process exited with code ${code}`,
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}