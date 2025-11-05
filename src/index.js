import { program, Command } from 'commander';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './core/db.js';
import { enqueueCommand } from './commands/enqueue.js';
import { workerCommand } from './commands/worker.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { dlqCommand } from './commands/dlq.js';
import { configCommand } from './commands/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure locks directory exists
const locksDir = path.join(dataDir, 'locks');
if (!fs.existsSync(locksDir)) {
  fs.mkdirSync(locksDir, { recursive: true });
}

// Ensure pids directory exists
const pidsDir = path.join(dataDir, 'pids');
if (!fs.existsSync(pidsDir)) {
  fs.mkdirSync(pidsDir, { recursive: true });
}

// Initialize database
try {
  initializeDatabase();
} catch (error) {
  console.error(chalk.red('✗ Failed to initialize database:'), error.message);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

program
  .name('queuectl')
  .description(chalk.blue.bold('🚀 QueueCTL - Background Job Queue System'))
  .version(packageJson.version, '-v, --version', 'Show version')
  .helpOption('-h, --help', 'Show help');

// Enqueue Command
program
  .command('enqueue <job>')
  .description('Add a new job to the queue')
  .action(enqueueCommand);

// Worker Commands
program
  .command('worker')
  .description('Manage worker processes')
  .addCommand(
    new Command('start')
      .option('--count <count>', 'Number of workers to start', '1')
      .description('Start worker processes')
      .action((options) => workerCommand('start', options))
  )
  .addCommand(
    new Command('stop')
      .description('Stop all running workers gracefully')
      .action(() => workerCommand('stop', {}))
  );

// Status Command
program
  .command('status')
  .description('Show queue status and active workers')
  .action(statusCommand);

// List Jobs Command
program
  .command('list')
  .option('--state <state>', 'Filter by job state (pending, processing, completed, failed, dead)')
  .description('List jobs in the queue')
  .action(listCommand);

// DLQ Commands
program
  .command('dlq')
  .description('Manage Dead Letter Queue')
  .addCommand(
    new Command('list')
      .option('--job <id>', 'Show specific job')
      .description('View DLQ jobs')
      .action((options) => dlqCommand('list', options))
  )
  .addCommand(
    new Command('retry <jobId>')
      .description('Retry a DLQ job (move back to pending)')
      .action((jobId) => dlqCommand('retry', { jobId }))
  );

// Config Commands
program
  .command('config')
  .description('Manage configuration')
  .addCommand(
    new Command('set <key> <value>')
      .description('Set a configuration value')
      .action((key, value) => configCommand('set', { key, value }))
  )
  .addCommand(
    new Command('get [key]')
      .description('Get configuration value (all if not specified)')
      .action((key) => configCommand('get', { key }))
  );

// Parse and handle
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
