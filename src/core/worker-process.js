import { spawn } from 'child_process';
import { processNextJob as claimNextJob } from './db.js';  // Import from db.js
import {
  completeJob,
  failJob,
  getBackoffDelay,
} from './queue.js';
import chalk from 'chalk';
export async function processNextJob(workerId) {
  console.log(`[Worker ${workerId}] Polling for job...`);
  
  let job = await claimNextJob();
  
  if (!job) {
    console.log(`[Worker ${workerId}] No pending job found`);
    return null;
  }

  console.log(chalk.blue(`[Worker ${workerId}] Starting job: ${job.id} - ${job.command}`));

  try {
    if (job.attempts > 1) {
      const backoffDelay = await getBackoffDelay(job.attempts - 1);
      console.log(chalk.gray(`[Worker ${workerId}] Backoff delay: ${backoffDelay}s for retry attempt ${job.attempts}`));
      await sleep(backoffDelay * 1000);
    }

    const result = await executeCommand(job.command);

    if (result.success) {
      await completeJob(job.id, result.output);
      console.log(chalk.green(`[Worker ${workerId}]  Job completed: ${job.id}`));
    } else {
      await failJob(job.id, result.error);
      console.log(chalk.yellow(`[Worker ${workerId}]  Job failed: ${job.id}`));
    }

    return result;
  } catch (error) {
    await failJob(job.id, error.message);
    console.error(chalk.red(`[Worker ${workerId}] Error processing job: ${error.message}`));
    return null;
  }
}

export function executeCommand(command) {
  return new Promise((resolve) => {
    const timeout = parseInt(process.env.WORKER_TIMEOUT) || 300000;

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