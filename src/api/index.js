import express from 'express';
import cors from 'cors';
import jobsRouter from './jobs.js';
import dlqRouter from './dlq.js';
import { getJobStatus } from '../core/queue.js'; // If using ES modules
import { initializeDatabase } from '../core/db.js'; // or require
await initializeDatabase();


const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/jobs', jobsRouter);
app.use('/api/dlq', dlqRouter);

app.get('/api/status', async (req, res) => {
    try {
      const status = await getJobStatus();
      res.json(status);
    } catch (err) {
      console.error("Error in /api/status:", err); // <--- Add this line!
      res.status(500).json({ error: 'Unable to retrieve status' });
    }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
