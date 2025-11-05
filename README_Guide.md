# QueueCTL - Complete Implementation Guide

QueueCTL is a production-grade, CLI-based background job queue system built with **Node.js**.

---

## 🚀 Features

- **Multi-worker architecture** with process isolation  
- **Automatic retry mechanism** using exponential backoff  
- **Dead Letter Queue (DLQ)** for permanent failures  
- **Persistent storage** using SQLite  
- **Race condition prevention** through file-based locking  
- **Graceful shutdown** with signal handling  
- **Rich CLI interface** with comprehensive commands  

---

## 🧱 System Architecture

### Core Components

1. **CLI Layer**  
   Handles command parsing and user interaction (`enqueue`, `worker`, `status`, `list`, `dlq`, `config`)

2. **Queue Manager**  
   Manages job states, retry logic, and database operations

3. **Worker Layer**  
   Executes jobs, handles commands, and manages worker processes

---

## ⚙️ Technology Stack

| Component | Description |
|------------|--------------|
| **Runtime** | Node.js 16+ |
| **Database** | SQLite with WAL mode |
| **CLI Framework** | Commander.js |
| **Process Management** | Node.js `child_process` |
| **Locking Mechanism** | File-based (atomic creation) |

---

## 🔁 Job Lifecycle

```
PENDING → PROCESSING → COMPLETED
          ↓
        FAILED
          ↓
   (if retries remaining)
          ↓
         DEAD (DLQ)
```

---

## 🧩 Installation & Quick Start

### Prerequisites

- Node.js 16.0+
- npm 7.0+

### Setup

```bash
npm install
```

### Start Workers

```bash
node src/index.js worker start --count 2
```

### Enqueue a Job

```bash
node src/index.js enqueue '{"id":"job1","command":"echo Success"}'
```

### Check Status

```bash
node src/index.js status
```

---

## 🧰 CLI Command Reference

### Enqueue Jobs

```bash
node src/index.js enqueue '{"id":"job1","command":"echo test","max_retries":3}'
```

### Manage Workers

```bash
# Start workers
node src/index.js worker start --count 3

# Stop workers
node src/index.js worker stop
```

### Queue Operations

```bash
# Overall status
node src/index.js status

# List all jobs
node src/index.js list

# Filter by state
node src/index.js list --state pending

# Dead Letter Queue
node src/index.js dlq list
node src/index.js dlq retry job-id

# Configuration
node src/index.js config set max-retries 5
node src/index.js config get all
```

---

## 🗄️ Database Schema

### Jobs Table

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT,
  updated_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  output TEXT
);
```

### DLQ Table

```sql
CREATE TABLE dlq (
  id TEXT PRIMARY KEY,
  job_data TEXT NOT NULL,
  moved_at TEXT NOT NULL,
  reason TEXT
);
```

### Config Table

```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 🔁 Retry Strategy

**Exponential Backoff Formula:**  
`wait = base ^ attempt`

**Default Configuration:**

| Parameter | Default | Description |
|------------|----------|-------------|
| `backoff-base` | 2 | Exponential backoff base |
| `backoff-max` | 300s | Maximum backoff delay |
| `max-retries` | 3 | Maximum retry attempts |

**Example Timeline (base = 2):**

| Attempt | Wait Time |
|----------|------------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | Moved to DLQ |

---

## 🔒 Concurrency & Locking

### Race Condition Prevention

1. **File-Based Locks**
   - Atomic lock file creation ensures single worker per job  
   - Lock Path: `./data/locks/job_{id}.lock`  
   - Lock contains: `jobId`, `timestamp`, `PID`

2. **SQLite Transactions**
   - ACID-compliant operations with WAL mode  
   - Prevents dirty reads  
   - Ensures data consistency  

**Result:** Same job never processed by multiple workers.

---

## 📁 Project Structure

```
queuectl/
├── src/
│   ├── index.js                 # CLI entry point
│   ├── commands/                # CLI commands
│   │   ├── enqueue.js
│   │   ├── worker.js
│   │   ├── status.js
│   │   ├── list.js
│   │   ├── dlq.js
│   │   └── config.js
│   └── core/                    # Core logic
│       ├── db.js
│       ├── queue.js
│       ├── worker-process.js
│       ├── worker-runner.js
│       ├── lock.js
│       └── config.js
├── test/
│   └── integration.test.js
├── data/
│   ├── queuectl.db
│   ├── locks/
│   └── pids/
├── package.json
├── README.md
├── DESIGN.md
└── .gitignore
```

---

## 🧪 Testing

### Run Tests

```bash
npm test
```

**Test Coverage Includes:**

- Job creation and retrieval  
- Job state transitions  
- DLQ operations  
- Command execution (success and failure)  
- Multi-job handling  

---

## 🧍 Manual Test Scenarios

### Test 1: Basic Execution

```bash
node src/index.js worker start --count 1
node src/index.js enqueue '{"id":"test1","command":"echo Success"}'
node src/index.js status
```

### Test 2: Retry with Backoff

```bash
node src/index.js enqueue '{"id":"test2","command":"exit 1","max_retries":3}'
node src/index.js worker start --count 1
```

### Test 3: Data Persistence

```bash
node src/index.js enqueue '{"id":"persist1","command":"sleep 5"}'
node src/index.js worker start --count 1 &
sleep 2 && kill %1
node src/index.js list
node src/index.js worker start --count 1
```

### Test 4: DLQ Management

```bash
node src/index.js enqueue '{"id":"dlq-test","command":"false","max_retries":1}'
node src/index.js worker start --count 1
node src/index.js dlq list
node src/index.js dlq retry dlq-test
```

---

## ⚡ Performance

| Metric | Description |
|---------|--------------|
| **Throughput** | ~100 jobs/minute per worker |
| **Latency** | Job pickup <100ms |
| **Lock acquisition** | <1ms |
| **State logging** | <10ms |

---

## ⚙️ Configuration

### Default Parameters

| Parameter | Default | Description |
|------------|----------|-------------|
| `max-retries` | 3 | Maximum retry attempts |
| `backoff-base` | 2 | Exponential backoff base |
| `backoff-max` | 300 | Maximum delay (seconds) |
| `worker-timeout` | 300 | Job timeout (seconds) |

### Modify Configuration

```bash
node src/index.js config set max-retries 10
node src/index.js config set backoff-base 3
```

---

## 🚢 Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "src/index.js", "worker", "start", "--count", "2"]
```

### Systemd Service

`/etc/systemd/system/queuectl.service`

```ini
[Unit]
Description=QueueCTL Worker
After=network.target

[Service]
Type=simple
User=queuectl
WorkingDirectory=/opt/queuectl
ExecStart=/usr/bin/node /opt/queuectl/src/index.js worker start --count 4
Restart=always
RestartSec=10
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**

```bash
sudo systemctl enable queuectl
sudo systemctl start queuectl
```

---

## 🧯 Troubleshooting

| Issue | Solution |
|-------|-----------|
| **Database is locked** | Stop workers, clean locks, restart |
| | `node src/index.js worker stop`<br>`rm -rf ./data/locks/*`<br>`node src/index.js worker start --count 2` |
| **Jobs not progressing** | Check and start workers: `node src/index.js status` |
| **Command not found** | Test manually: `bash -c "your-command-here"` and ensure permissions |

---

## 🧠 Architecture Decisions

### Why SQLite?
- Embedded, no server needed  
- ACID-compliant  
- Sufficient for single-machine setups  
- Minimal operational overhead  

### Why File-Based Locking?
- No external dependencies  
- Simple and debuggable  
- Ideal for local environments  

### Why Child Processes?
- True parallelism  
- Process isolation  
- Simple signal handling  

---

## 🔮 Future Enhancements

- Web dashboard for monitoring  
- Job scheduling / delayed jobs  
- Priority queues  
- PostgreSQL support  
- Redis for distributed locking  
- Multi-machine deployment  
- Job dependencies  
- Advanced metrics  

---

## ✅ Summary

QueueCTL provides a **production-ready background job queue system** with:

- **Reliability** – Persistent storage, auto-recovery  
- **Scalability** – Multi-worker support  
- **Safety** – Race condition prevention, graceful shutdown  
- **Maintainability** – Clear code structure, strong documentation  
- **Observability** – CLI-based monitoring and reporting  

Perfect for **background job processing with retry logic and failure handling**.

---

## 📚 References

1. [System Design: Distributed Task Queue](https://www.geeksforgeeks.org/system-design/distributed-task-queue-distributed-systems/)
2. [Design a Distributed Job Scheduler](https://www.systemdesignhandbook.com/guides/design-a-distributed-job-scheduler/)
3. [Distributed Locking and Race Condition Prevention](https://dzone.com/articles/distributed-locking-and-race-condition-prevention)
4. [Queue-Based Exponential Backoff](https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3)
5. [Dead Letter Queue System Design](https://www.geeksforgeeks.org/system-design/dead-letter-queue-system-design/)
6. [Building CLI Tools with Node.js](https://javascript.plainenglish.io/creating-a-cli-tool-with-node-js-26a1e3b595fd)
7. [Modern Queue Patterns Guide](https://dzone.com/articles/modern-queue-patterns-guide)
