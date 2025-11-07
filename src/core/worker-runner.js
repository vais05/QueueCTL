import { processNextJob } from './worker-process.js';

const workerId = process.argv[2] || '1';

async function runWorker() {
  console.log(`[Worker ${workerId}] Started`);

  const handleShutdown = () => {
    console.log(`[Worker ${workerId}] Shutting down gracefully...`);
    process.exit(0);
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  while (true) {
    try {
      console.log(`[Worker ${workerId}] Polling for job...`);
      const result = await processNextJob(workerId);
      console.log(`[Worker ${workerId}] processNextJob returned:`, result);

      if (result === null) {
        console.log(`[Worker ${workerId}] No pending jobs left. All jobs completed.`);
        break;  
      }
    } catch (error) {
      console.error(`[Worker ${workerId}] Error:`, error.message);
      await sleep(1000);
    }
  }

  console.log(`[Worker ${workerId}] Exiting.`);
  process.exit(0);
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runWorker().catch(error => {
  console.error('Worker error:', error);
  process.exit(1);
});
