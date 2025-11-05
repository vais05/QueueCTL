import chalk from 'chalk';
import { getDLQJobs, getDLQJob, restoreDLQJobToQueue } from '../core/db.js';
import { table } from 'table';

export function dlqCommand(action, options) {
  if (action === 'list') {
    const jobId = options.job;
    
    if (jobId) {
      const job = getDLQJob(jobId);
      if (!job) {
        console.log(chalk.red(`✗ DLQ job not found: ${jobId}`));
        return;
      }

      const jobData = JSON.parse(job.job_data);
      console.log(chalk.bold.magenta(`\\n☠ Dead Letter Queue - Job Details\\n`));
      console.log(`ID: ${chalk.cyan(job.id)}`);
      console.log(`Command: ${chalk.yellow(jobData.command)}`);
      console.log(`Max Retries: ${jobData.max_retries}`);
      console.log(`Moved At: ${job.moved_at}`);
      console.log(`Reason: ${chalk.red(job.reason)}`);
      console.log(`Original Created: ${jobData.created_at}`);
      console.log();
    } else {
      const jobs = getDLQJobs();

      if (jobs.length === 0) {
        console.log(chalk.green('✓ Dead Letter Queue is empty'));
        return;
      }

      const data = [
        [
          chalk.bold('ID'),
          chalk.bold('Command'),
          chalk.bold('Reason'),
          chalk.bold('Moved At'),
        ],
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

      console.log(chalk.bold.magenta(`\\n☠ Dead Letter Queue: ${jobs.length} jobs\\n`));
      console.log(table(data));
    }
  } else if (action === 'retry') {
    const jobId = options.jobId;
    const dlqJob = getDLQJob(jobId);

    if (!dlqJob) {
      console.log(chalk.red(`✗ DLQ job not found: ${jobId}`));
      return;
    }

    restoreDLQJobToQueue(jobId);
    console.log(chalk.green(`✓ Job moved back to pending queue: ${jobId}`));
  }
}