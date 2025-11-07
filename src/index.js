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
import { dlqList, dlqMove, dlqRestore } from './commands/dlq.js';
import { configCommand } from './commands/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const locksDir = path.join(dataDir, 'locks');
if (!fs.existsSync(locksDir)) {
  fs.mkdirSync(locksDir, { recursive: true });
}

const pidsDir = path.join(dataDir, 'pids');
if (!fs.existsSync(pidsDir)) {
  fs.mkdirSync(pidsDir, { recursive: true });
}

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

program
  .command('enqueue <job>')
  .description('Add a new job to the queue')
  .action(enqueueCommand);

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

program
  .command('status')
  .description('Show queue status and active workers')
  .action(statusCommand);

program
  .command('list')
  .option('--state <state>', 'Filter by job state (pending, processing, completed, failed, dead)')
  .description('List jobs in the queue')
  .action(listCommand);

const dlq = new Command('dlq')
  .description('Manage Dead Letter Queue');

dlq
  .command('list')
  .argument('[jobId]')
  .description('List DLQ jobs or show details for one job')
  .action(dlqList);

dlq
  .command('move')
  .argument('<id>')
  .description('Move a failed job to DLQ')
  .action(dlqMove);

dlq
  .command('restore')
  .argument('<id>')
  .description('Restore a job from DLQ to pending')
  .action(dlqRestore);

program.addCommand(dlq);


program
  .command('config')
  .description('Manage configuration')
  .addCommand(
    new Command('set')
      .argument('<key>')
      .argument('<value>')
      .description('Set a configuration value')
      .action((key, value) => {
        configCommand('set', { key, value });
      })
  )
  .addCommand(
    new Command('get')
      .argument('[key]')
      .description('Get configuration value (all if not specified)')
      .action((key) => {
        configCommand('get', { key });
      })
  );

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
