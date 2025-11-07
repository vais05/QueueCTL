import chalk from 'chalk';
import { getAllJobs, getJobsByState } from '../core/db.js';
import { table } from 'table';

export async function listCommand(options) {
  const state = options.state;
  const result = state ? await getJobsByState(state) : await getAllJobs();

  const jobs = Array.isArray(result) ? result : (result?.jobs ?? []);

  if (jobs.length === 0) {
    console.log(chalk.yellow('No jobs found'));
    return;
  }

  const data = [
    [
      chalk.bold('ID'),
      chalk.bold('Command'),
      chalk.bold('State'),
      chalk.bold('Attempts'),
      chalk.bold('Created'),
    ],
    ...jobs.slice(0, 20).map(job => [
      chalk.cyan(job.id.substring(0, 12)),
      job.command.substring(0, 40) + (job.command.length > 40 ? '...' : ''),
      getStateColor(job.state),
      `${job.attempts}/${job.max_retries}`,
      new Date(job.created_at).toLocaleString(),
    ]),
  ];

  console.log(chalk.bold.cyan(`\n Jobs (${state ? state : 'all'}): ${jobs.length}\n`));
  console.log(table(data));
}

function getStateColor(state) {
  switch (state) {
    case 'completed': return chalk.green('✓ ' + state);
    case 'pending': return chalk.blue('⧗ ' + state);
    case 'processing': return chalk.yellow('⟳ ' + state);
    case 'failed': return chalk.red('✗ ' + state);
    case 'dead': return chalk.magenta('☠ ' + state);
    default: return state;
  }
}
