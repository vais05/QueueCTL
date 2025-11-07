import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { processNextJob } from '../core/worker-process.js';
import { cleanupAllLocks } from '../core/lock.js';

const pidsDir = path.join(process.cwd(), 'data', 'pids');

function getPidFilePath(workerId) {
  if (!fs.existsSync(pidsDir)) {
    fs.mkdirSync(pidsDir, { recursive: true });
  }
  return path.join(pidsDir, `worker_${workerId}.pid`);
}

async function runWorker(workerId) {
  console.log(chalk.blue(`[Worker ${workerId}] Started`));

  const handleShutdown = () => {
    console.log(chalk.yellow(`[Worker ${workerId}] Shutting down gracefully...`));
    fs.unlinkSync(getPidFilePath(workerId));
    process.exit(0);
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  let consecutiveEmpty = 0;
  while (true) {
    try {
      const result = await processNextJob(workerId);

      if (result === null) {
        consecutiveEmpty++;
        if (consecutiveEmpty > 5) {
          await sleep(1000);
          consecutiveEmpty = 0;
        } else {
          await sleep(100);
        }
      } else {
        consecutiveEmpty = 0;
      }
    } catch (error) {
      console.error(chalk.red(`[Worker ${workerId}] Error:`, error.message));
      await sleep(1000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function workerCommand(action, options) {
  if (action === 'start') {
    const count = parseInt(options.count) || 1;

    if (count < 1 || count > 100) {
      console.error(chalk.red('✗ Worker count must be between 1 and 100'));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Starting ${count} worker(s)...`));

    const workers = [];

    for (let i = 0; i < count; i++) {
      const workerId = i + 1;
      const pidFile = getPidFilePath(workerId);

      const workerProcess = spawn('node', [
        fileURLToPath(new URL('../core/worker-runner.js', import.meta.url)),
        String(workerId),
      ], {
        stdio: 'inherit',
      });

      fs.writeFileSync(pidFile, String(workerProcess.pid));
      workers.push(workerProcess.pid);

      console.log(chalk.blue(`  Worker ${workerId} started (PID: ${workerProcess.pid})`));

    }

    console.log(chalk.green('✓ Workers started'));
    console.log(chalk.gray('  Use "queuectl status" to check workers'));
  } else if (action === 'stop') {
    console.log(chalk.blue('Stopping all workers...'));

    try {
      const pidFiles = fs.readdirSync(pidsDir).filter(f => f.startsWith('worker_'));
      let stoppedCount = 0;

      pidFiles.forEach(file => {
        const pidFile = path.join(pidsDir, file);
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));

        try {
          process.kill(pid, 'SIGTERM');
          fs.unlinkSync(pidFile);
          stoppedCount++;
          console.log(chalk.yellow(`  Stopped worker (PID: ${pid})`));
        } catch (error) {
          try {
            fs.unlinkSync(pidFile);
          } catch {}
        }
      });

      cleanupAllLocks();

      console.log(chalk.green(`✓ Stopped ${stoppedCount} worker(s)`));
    } catch (error) {
      console.log(chalk.yellow('✓ No workers running'));
    }
  }
}