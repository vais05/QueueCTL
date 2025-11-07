import express from 'express';
import { getJobsByState } from '../core/queue.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { state } = req.query;
  const jobs = await getJobsByState(state);
  res.json(jobs);
});

export default router;
