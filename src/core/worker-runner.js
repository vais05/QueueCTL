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
      console.error(`[Worker ${workerId}] Error:`, error.message);
      await sleep(1000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runWorker().catch(error => {
  console.error('Worker error:', error);
  process.exit(1);
});