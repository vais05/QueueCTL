import express from 'express';
import { retryDeadJob } from '../core/queue.js';

const router = express.Router();

router.post('/retry/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    await retryDeadJob(jobId);
    res.status(200).send('Job retried');
  } catch (err) {
    res.status(400).send('Failed to retry job');
  }
});

export default router;
