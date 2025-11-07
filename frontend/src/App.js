import React, { useEffect, useState } from 'react';

const JOB_STATES = ['pending', 'processing', 'completed', 'failed', 'dead'];

function App() {
  const [jobs, setJobs] = useState([]);
  const [selectedState, setSelectedState] = useState('pending');
  const [selectedJob, setSelectedJob] = useState(null);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [dlqLoading, setDlqLoading] = useState(false);

  // Load status counts
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error('Failed to load status:', err));
  }, []);

  // Load jobs by state
  useEffect(() => {
    setLoading(true);
    fetch(`/api/jobs?state=${selectedState}`)
      .then(res => res.json())
      .then(data => {
        setJobs(data);
        setSelectedJob(null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load jobs:', err);
        setLoading(false);
      });
  }, [selectedState]);

  const retryDlqJob = (jobId) => {
    setDlqLoading(true);
    fetch(`/api/dlq/retry/${jobId}`, { method: 'POST' })
      .then(res => {
        if (res.ok) {
          alert(`Job ${jobId} retried successfully.`);
          setSelectedState('pending');
        } else {
          alert(`Failed to retry job ${jobId}`);
        }
        setDlqLoading(false);
      })
      .catch(err => {
        console.error('Error retrying job:', err);
        setDlqLoading(false);
      });
  };

  return (
    <div style={{ margin: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>QueueCTL Job Dashboard</h1>
      
      <div>
        <strong>Status:</strong> Completed: {status.completed || 0}, Pending: {status.pending || 0},
        Processing: {status.processing || 0}, Failed: {status.failed || 0}, DLQ: {status.dead || 0}
      </div>
      <div style={{ marginTop: '20px' }}>
        <label>Filter by Job State: </label>
        <select value={selectedState} onChange={e => setSelectedState(e.target.value)}>
          {JOB_STATES.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading jobs...</p>}

      {!loading && (
        <table border="1" cellPadding="8" style={{ marginTop: '20px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Command</th>
              <th>Attempts</th>
              <th>Max Retries</th>
              <th>State</th>
              <th>Created At</th>
              <th>Updated At</th>
              {selectedState === 'dead' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={selectedState === 'dead' ? 8 : 7} align="center">No jobs found</td>
              </tr>
            )}
            {jobs.map(job => (
              <tr 
                key={job.id} 
                onClick={() => setSelectedJob(job)} 
                style={{ cursor: 'pointer', backgroundColor: selectedJob?.id === job.id ? '#eef' : 'transparent' }}
              >
                <td>{job.id}</td>
                <td><pre style={{ margin: 0 }}>{job.command}</pre></td>
                <td>{job.attempts}</td>
                <td>{job.max_retries}</td>
                <td>{job.state}</td>
                <td>{new Date(job.created_at).toLocaleString()}</td>
                <td>{new Date(job.updated_at).toLocaleString()}</td>
                {selectedState === 'dead' && (
                  <td>
                    <button onClick={e => { e.stopPropagation(); retryDlqJob(job.id); }} disabled={dlqLoading}>
                      Retry
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedJob && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
          <h3>Job Details</h3>
          <p><strong>ID:</strong> {selectedJob.id}</p>
          <p><strong>Command:</strong> {selectedJob.command}</p>
          <p><strong>State:</strong> {selectedJob.state}</p>
          <p><strong>Attempts:</strong> {selectedJob.attempts} / {selectedJob.max_retries}</p>
          <p><strong>Created At:</strong> {new Date(selectedJob.created_at).toLocaleString()}</p>
          <p><strong>Updated At:</strong> {new Date(selectedJob.updated_at).toLocaleString()}</p>
          {selectedJob.last_error && <p><strong>Last Error:</strong> {selectedJob.last_error}</p>}
        </div>
      )}
    </div>
  );
}

export default App;
