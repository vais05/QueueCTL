import chalk from 'chalk';
import { getDLQJobs, getDLQJob, moveJobToDLQ, restoreDLQJobToQueue } from '../core/db.js';
import { table } from 'table';

export async function dlqList(jobId) {
  if (jobId) {
    const job = await getDLQJob(jobId);
    if (!job) {
      console.log(chalk.red(`✗ DLQ job not found: ${jobId}`));
      return;
    }

    const jobData = JSON.parse(job.job_data);
    console.log(chalk.bold.magenta(`\n☠ Dead Letter Queue - Job Details\n`));
    console.log(`ID: ${chalk.cyan(job.id)}`);
    console.log(`Command: ${chalk.yellow(jobData.command)}`);
    console.log(`Max Retries: ${jobData.max_retries}`);
    console.log(`Moved At: ${job.moved_at}`);
    console.log(`Reason: ${chalk.red(job.reason)}`);
    console.log(`Original Created: ${jobData.created_at}`);
    console.log();
    return;
  }

  const jobs = await getDLQJobs();
  if (!jobs.length) {
    console.log(chalk.green('✓ Dead Letter Queue is empty'));
    return;
  }

  const data = [
    [chalk.bold('ID'), chalk.bold('Command'), chalk.bold('Reason'), chalk.bold('Moved At')],
    ...jobs.map(job => {
      const jobData = JSON.parse(job.job_data);
      return [
        chalk.cyan(job.id.substring(0, 12)),
        jobData.command.substring(0, 30) + (jobData.command.length > 30 ? '...' : ''),
        job.reason.substring(0, 30) + (job.reason.length > 30 ? '...' : ''),
        new Date(job.moved_at).toLocaleString(),
      ];
    }),
  ];

  console.log(chalk.bold.magenta(`\n☠ Dead Letter Queue: ${jobs.length} jobs\n`));
  console.log(table(data));
}

// Move job to DLQ
export async function dlqMove(id) {
  if (!id) return console.log(chalk.red('✗ Job ID required'));
  await moveJobToDLQ(id, 'Manually moved to DLQ');
  console.log(chalk.green(`✓ Job ${id} moved to DLQ`));
}

// Restore job from DLQ to pending
export async function dlqRestore(id) {
  if (!id) return console.log(chalk.red('✗ Job ID required'));
  await restoreDLQJobToQueue(id);
  console.log(chalk.green(`✓ Job ${id} restored to queue`));
}
