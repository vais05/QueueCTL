import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { insertJob } from '../core/db.js';

export function enqueueCommand(jobJson) {
  try {
    const jobData = JSON.parse(jobJson);

    // Validate required fields
    if (!jobData.command) {
      console.error(chalk.red('✗ Error: "command" field is required'));
      process.exit(1);
    }

    // Generate ID if not provided
    if (!jobData.id) {
      jobData.id = `job_${uuidv4()}`;
    }

    // Set defaults
    jobData.state = 'pending';
    jobData.attempts = 0;
    jobData.max_retries = jobData.max_retries || 3;
    jobData.created_at = new Date().toISOString();
    jobData.updated_at = new Date().toISOString();

    insertJob(jobData);

    console.log(chalk.green('✓ Job enqueued successfully'));
    console.log(`  ID: ${chalk.cyan(jobData.id)}`);
    console.log(`  Command: ${chalk.cyan(jobData.command)}`);
    console.log(`  Max Retries: ${chalk.cyan(jobData.max_retries)}`);
  } catch (error) {
    console.error(chalk.red('✗ Error parsing job JSON:'), error.message);
    process.exit(1);
  }
}
