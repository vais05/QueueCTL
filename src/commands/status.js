import chalk from 'chalk';
import { getQueueStats } from '../core/db.js';
import fs from 'fs';
import path from 'path';

export function statusCommand() {
  const stats = getQueueStats();

  const pidsDir = path.join(process.cwd(), 'data', 'pids');
  let activeWorkers = 0;
  let workerPids = [];

  if (fs.existsSync(pidsDir)) {
    const pidFiles = fs.readdirSync(pidsDir).filter(f => f.startsWith('worker_'));
    
    pidFiles.forEach(file => {
      const pidFile = path.join(pidsDir, file);
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
      
      try {
        // Check if process still exists
        process.kill(pid, 0);
        activeWorkers++;
        workerPids.push(pid);
      } catch (error) {
        // Process dead, clean up file
        try {
          fs.unlinkSync(pidFile);
        } catch {}
      }
    });
  }

  console.log(chalk.bold.cyan('\\n📊 Queue Status\\n'));

  console.log(chalk.gray('Job States:'));
  console.log(chalk.green(`  ✓ Completed: ${stats.completed}`));
  console.log(chalk.blue(`  ⧗ Pending: ${stats.pending}`));
  console.log(chalk.yellow(`  ⟳ Processing: ${stats.processing}`));
  console.log(chalk.red(`  ✗ Failed: ${stats.failed}`));
  console.log(chalk.magenta(`  ☠ Dead (DLQ): ${stats.dlq}`));

  console.log(chalk.gray('\\nWorkers:'));
  console.log(chalk.green(`  Active: ${activeWorkers}`));
  if (workerPids.length > 0) {
    console.log(chalk.cyan(`  PIDs: ${workerPids.join(', ')}`));
  }

  const totalJobs = stats.pending + stats.processing + stats.completed + stats.failed;
  console.log(chalk.gray('\\nTotal:'));
  console.log(chalk.bold(`  ${totalJobs} jobs processed`));

  console.log();
}