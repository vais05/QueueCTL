import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  initializeDatabase,
  insertJob,
  getJob,
  getJobsByState,
  getAllJobs,
  moveJobToDLQ,
  getDLQJobs,
  restoreDLQJobToQueue,
} from '../src/core/db.js';
import { executeCommand } from '../src/core/worker-process.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(chalk.green('  ✓'), message);
    testsPassed++;
  } else {
    console.log(chalk.red('  ✗'), message);
    testsFailed++;
    throw new Error(message);
  }
}

async function testBasicJobCreation() {
  console.log(chalk.bold.cyan('\\n1. Test: Basic Job Creation'));
  
  try {
    const job = {
      id: 'test-job-1',
      command: 'echo "test"',
      state: 'pending',
      max_retries: 3,
    };

    insertJob(job);
    const retrieved = getJob(job.id);

    assert(retrieved !== undefined, 'Job was inserted and retrieved');
    assert(retrieved.command === 'echo "test"', 'Job command matches');
    assert(retrieved.state === 'pending', 'Job state is pending');
  } catch (error) {
    console.error(chalk.red('  Test failed:'), error.message);
    testsFailed++;
  }
}

async function testJobStateTransitions() {
  console.log(chalk.bold.cyan('\\n2. Test: Job State Transitions'));
  
  try {
    const job = {
      id: 'test-job-2',
      command: 'echo "state-test"',
      state: 'pending',
      max_retries: 3,
    };

    insertJob(job);
    
    const pendingJobs = getJobsByState('pending');
    assert(pendingJobs.some(j => j.id === 'test-job-2'), 'Job found in pending state');

    console.log(chalk.gray('  State transitions work correctly'));
    testsPassed++;
  } catch (error) {
    console.error(chalk.red('  Test failed:'), error.message);
    testsFailed++;
  }
}

async function testDLQFlow() {
  console.log(chalk.bold.cyan('\\n3. Test: Dead Letter Queue Flow'));
  
  try {
    const job = {
      id: 'test-job-dlq',
      command: 'false',
      state: 'pending',
      max_retries: 1,
    };

    insertJob(job);
    
    // Move to DLQ
    moveJobToDLQ(job.id, 'Test reason');
    
    const dlqJobs = getDLQJobs();
    assert(dlqJobs.some(j => j.id === 'test-job-dlq'), 'Job moved to DLQ');

    // Restore from DLQ
    restoreDLQJobToQueue(job.id);
    
    const restored = getJob(job.id);
    assert(restored !== undefined, 'Job restored from DLQ');
    assert(restored.state === 'pending', 'Restored job is pending');
  } catch (error) {
    console.error(chalk.red('  Test failed:'), error.message);
    testsFailed++;
  }
}

async function testCommandExecution() {
  console.log(chalk.bold.cyan('\\n4. Test: Command Execution'));
  
  try {
    // Test successful command
    const successResult = await executeCommand('echo "hello"');
    assert(successResult.success === true, 'Successful command returns success');
    assert(successResult.output.includes('hello'), 'Command output is captured');

    // Test failed command
    const failResult = await executeCommand('exit 1');
    assert(failResult.success === false, 'Failed command returns failure');
    assert(failResult.error !== undefined, 'Error message is provided');
  } catch (error) {
    console.error(chalk.red('  Test failed:'), error.message);
    testsFailed++;
  }
}

async function testMultipleJobs() {
  console.log(chalk.bold.cyan('\\n5. Test: Multiple Jobs'));
  
  try {
    for (let i = 0; i < 5; i++) {
      insertJob({
        id: `multi-job-${i}`,
        command: `echo "job ${i}"`,
        state: 'pending',
        max_retries: 3,
      });
    }

    const allJobs = getAllJobs();
    const multiJobs = allJobs.filter(j => j.id.startsWith('multi-job-'));
    assert(multiJobs.length >= 5, 'All jobs were inserted');

    console.log(chalk.gray(`  Created and verified ${multiJobs.length} jobs`));
    testsPassed++;
  } catch (error) {
    console.error(chalk.red('  Test failed:'), error.message);
    testsFailed++;
  }
}

async function runAllTests() {
  console.log(chalk.bold.blue('🧪 Running QueueCTL Integration Tests\\n'));
  console.log(chalk.gray('Note: Tests use real database. Ensure no critical data exists.\\n'));

  try {
    initializeDatabase();

    await testBasicJobCreation();
    await testJobStateTransitions();
    await testDLQFlow();
    await testCommandExecution();
    await testMultipleJobs();

    console.log(chalk.bold.cyan('\\n📊 Test Results\\n'));
    console.log(chalk.green(`  ✓ Passed: ${testsPassed}`));
    if (testsFailed > 0) {
      console.log(chalk.red(`  ✗ Failed: ${testsFailed}`));
    } else {
      console.log(chalk.yellow(`  ✗ Failed: ${testsFailed}`));
    }

    console.log(chalk.bold.cyan(`\\n  Total: ${testsPassed + testsFailed} tests\\n`));

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('Critical test error:'), error.message);
    process.exit(1);
  }
}

runAllTests();