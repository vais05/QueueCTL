import fs from 'fs';
  import path from 'path';
  
  const locksDir = path.join(process.cwd(), 'data', 'locks');
  
  export function acquireLock(jobId) {
    const lockPath = path.join(locksDir, `job_${jobId}.lock`);
  
    if (!fs.existsSync(locksDir)) {
      fs.mkdirSync(locksDir, { recursive: true });
    }
  
    try {
      fs.writeFileSync(lockPath, JSON.stringify({
        jobId,
        timestamp: new Date().toISOString(),
        pid: process.pid,
      }), { flag: 'wx' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  export function releaseLock(jobId) {
    const lockPath = path.join(locksDir, `job_${jobId}.lock`);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch (error) {
      console.error(`Failed to release lock for ${jobId}:`, error.message);
    }
  }
  
  export function isLocked(jobId) {
    const lockPath = path.join(locksDir, `job_${jobId}.lock`);
    return fs.existsSync(lockPath);
  }
  
  export function cleanupAllLocks() {
    try {
      if (fs.existsSync(locksDir)) {
        const files = fs.readdirSync(locksDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(locksDir, file));
        });
      }
    } catch (error) {
      console.error('Failed to cleanup locks:', error.message);
    }
  }