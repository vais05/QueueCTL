# QueueCTL - Project Delivery Summary & Quick Reference
---
QueueCTL is a **command-line job queue and worker processing system** that manages background tasks reliably.  
It supports multiple workers, automatic retries with **exponential backoff**, and a **Dead Letter Queue (DLQ)** for permanently failed jobs.  
The system ensures **persistent state**, safe concurrent processing, and clean operational observability through CLI commands.

---

### 🎥 Demo Video

[Watch the QueueCTL Demo Video on YouTube](https://www.youtube.com/watch?v=mkT0TZ0RSiw)

---

## 🧠 Problem Context & Purpose

Modern backend systems frequently run asynchronous background tasks such as report generation, notifications, and data processing.  
QueueCTL simulates a lightweight distributed job execution framework, similar to **Celery**, **Sidekiq**, or **BullMQ**, but implemented from scratch.

This project demonstrates:

- System design skills  
- Worker orchestration  
- Persistent job state management  
- Retry handling with exponential backoff  
- Graceful worker lifecycle handling
---

## ✅ Features

| Capability | Description |
|---|---|
| Persistent Job Storage | Jobs survive restarts using SQLite (WAL mode) |
| Multiple Worker Processes | Supports parallel job processing without overlap |
| Reliable Job Execution | Shell commands executed with success/failure capture |
| Automatic Retry + Backoff | Failed jobs retry using exponential backoff logic |
| Dead Letter Queue (DLQ) | Permanently failed jobs are isolated for inspection |
| Full Job Lifecycle Tracking | pending → processing → completed / failed / dead |
| Configuration System | Configure backoff base, max retries, etc. |
| Graceful Shutdown | Workers finish current job before exit |
| Web Dashboard (Bonus) | Visual job monitoring at `http://localhost:3000` |

---


## 📁 Project Structure

The full directory layout of QueueCTL:

```
queuectl/
├── src/
│   ├── index.js                 # CLI entry
│   ├── commands/                # CLI command modules
│   ├── core/                    # Business logic & persistence
│   ├── api/                     # Express API server for frontend
│   │   ├── index.js             # API server entry point
│   │   ├── jobs.js              # Jobs API routes
│   │   └── dlq.js               # DLQ API routes
├── frontend/
│   ├── public/
│   │   └── index.html           # React app HTML
│   ├── src/
│   │   ├── App.js               # React dashboard main component
│   │   ├── index.js             # React DOM render entry
│   ├── package.json             # React app dependencies
├── data/
│   ├── queuectl.db              # SQLite DB file
│   ├── locks/
│   └── pids/
├── test/
│   └── integration.test.js
├── package.json                 # Root backend dependencies (CLI + API)
├── README.md
└── .gitignore

```

---

## 🧱 System Architecture

```
┌─────────────────────────────────────────┐
│        CLI Interface Layer              │
│  enqueue | worker | status | list       │
│          dlq     | config               │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Queue Manager & Orchestrator       │
│  - Job state transitions                │
│  - Retry logic with backoff             │
│  - DLQ management                       │
└────────────────┬────────────────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
    ┌───────┐ ┌────────┐ ┌──────────┐
    │SQLite │ │File    │ │ Workers  │
    │  DB   │ │Locks   │ │(Processes)
    └───────┘ └────────┘ └──────────┘
```

---

## 🔁 Job Lifecycle State Machine

```
                  ┌─────────────┐
                  │   PENDING   │ ← Initial state
                  └──────┬──────┘
                         │ Worker picks up
                         ▼
                  ┌─────────────┐
                  │ PROCESSING  │ ← Executing job
                  └──────┬──────┘
                         │
                    ┌────┴────┐
                    │         │
            ✓ Success        ✗ Failure
                    │         │
                    ▼         ▼
              ┌─────────┐  ┌────────┐
              │COMPLETED│  │ FAILED │
              └─────────┘  └────┬───┘
                                │
                    ┌───────────┴──────────┐
                    │                      │
            Retries left?          Max retries?
                    │                      │
                 YES▼                      ▼NO
                    │              ┌──────────┐
            Wait with backoff       │   DEAD   │
            (2^n seconds)           │  (DLQ)   │
                    │               └──────────┘
                    └─────────────────────┘
                        Return to
                        PENDING
```
---

### Retry Backoff Formula

```
delay = backoff_base ^ attempts
```

Example: base = 2 → attempts: 1, 2, 3 → delay: 2s, 4s, 8s

---

## 🛠️ Setup Instructions

### 1. Install Dependencies

```
npm install
```

### 2. Ensure SQLite is Available

On Windows, SQLite comes bundled with Node.js native binaries – no extra installation needed.  
On macOS/Linux, verify installation with:

```
sqlite3 --version
```

### 3. Run CLI Commands

Use the following syntax to execute commands:

```
node src/index.js <command>
```

---

## 🚀 Usage Examples

### Enqueue Jobs

```
node src/index.js enqueue "{\"id\":\"job1\",\"command\":\"echo Hello\"}"
```

### List Jobs

```
node src/index.js list --state pending
```

### Start Worker(s)

```
node src/index.js worker start --count 1
```

### Stop Workers

```
node src/index.js worker stop
```

### Check Status

```
node src/index.js status
```

---

## ☠ Dead Letter Queue (DLQ)

### List DLQ Jobs

```
node src/index.js dlq list
```

### Move a Failed Job to DLQ

```
node src/index.js dlq move <job_id>
```

### Restore Job from DLQ

```
node src/index.js dlq restore <job_id>
```

---

## 📌 Demonstrated CLI Output

### Example: Enqueueing and Processing Jobs

<img width="530" height="246" alt="Image" src="https://github.com/user-attachments/assets/f6dd71ff-9144-4670-81a4-1b140c5786b6" />

```
node src/index.js enqueue "{\"id\":\"faculty_job1\",\"command\":\"echo Starting Work\"}"
✓ Job enqueued successfully

node src/index.js worker start --count 1
[Worker] Starting job: faculty_job1 - echo Starting Work  
[Worker] ✓ Job completed: faculty_job1
```

### Example: Failed Job with Retry and DLQ
<img width="530" height="246" alt="Image" src="https://github.com/user-attachments/assets/b756dc0a-9297-4277-a1a0-4b749b7b1606" />

```
node src/index.js enqueue "{\"id\":\"faculty_fail1\",\"command\":\"idontexist123\"}"

node src/index.js worker start --count 1
[Worker] ✗ Job failed: faculty_fail1  
[Worker] Backoff delay: 4s  
...  
Moved to DLQ
```
<img width="530" height="246" alt="Image" src="https://github.com/user-attachments/assets/ea4720aa-ee20-4e7f-9660-cde242b0441a" />

### Listing DLQ

```
node src/index.js dlq list
☠ Dead Letter Queue: 5 jobs
```
<img width="530" height="246" alt="Image" src="https://github.com/user-attachments/assets/f1104572-365d-43f5-a99c-ff0b1c2560cb" />
---

## ⚙️ Configuration Management

### Update Retry Count

```
node src/index.js config set max_retries 5
```

<img width="530" height="246" alt="Image" src="https://github.com/user-attachments/assets/42698a15-a821-45ee-9ff8-2eb4d8f84dfb" />

<img width="530" height="246" alt="Image" src="https://github.com/user-attachments/assets/2758c154-d796-47e9-b387-4094008f0f72" />
### Update Backoff Base

```
node src/index.js config set backoff_base 3
```

---

## 📝 Design Decisions & Trade‑Offs

| Decision | Rationale |
|-----------|------------|
| SQLite for persistence | Lightweight, reliable, no external dependency |
| CLI-based process control | Aligns with backend DevOps workflows |
| Exponential backoff (configurable) | Prevents hot-loop failures |
| Separate DLQ storage | Enables traceability and manual recovery |

---

## ✅ Final Checklist

- Persistent job storage  
- Multiple worker support  
- Exponential retry backoff  
- Dead Letter Queue  
- Restore & reprocess DLQ jobs  
- Clear CLI interaction  
- Demonstrated command outputs  

---


## 🏁 Conclusion

QueueCTL demonstrates a production-aligned job queue system, built with modular architecture, robust retry logic, and lifecycle management.  
It reflects real backend engineering practices applicable to distributed systems and microservice infrastructures.

---


## 📚 References

 1. https://www.geeksforgeeks.org/system-design/distributed-task-queue-distributed-systems/
 2. https://www.systemdesignhandbook.com/guides/design-a-distributed-job-scheduler/
 3. https://www.reddit.com/r/flask/comments/lvccgo/using_a_database_such_as_sqlite3_versus_json_to/
 4. https://dzone.com/articles/distributed-locking-and-race-condition-prevention
 5. https://dkharazi.github.io/notes/py/gunicorn/signal/
 6. https://stackoverflow.com/questions/22789079/json-vs-sqlite-which-is-more-suitable-for-android-ios-developmen
 t
 7. https://www.geeksforgeeks.org/computer-networks/handling-race-condition-in-distributed-system/
 8. https://www.linkedin.com/pulse/mastering-linux-kill-signals-graceful-shutdown-worker-joey-wang-pytce
 9. https://stackoverflow.com/questions/62182811/python-query-performance-on-json-vs-sqlite
 10. https://victoronsoftware.com/posts/distributed-lock/
 11. https://docs.gunicorn.org/en/stable/signals.html
 12. https://javascript.plainenglish.io/creating-a-cli-tool-with-node-js-26a1e3b595fd
 13. https://www.reddit.com/r/node/comments/dfmrlj/when_should_i_consider_a_database_instead_of/
 14. https://dev.to/sgchris/designing-a-job-queue-system-sidekiq-and-background-processing-2oln
 15. https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3
 16. https://www.reddit.com/r/programming/comments/18zs0is/nodejs_cli_apps_best_practices/
 17. https://www.geeksforgeeks.org/system-design/dead-letter-queue-system-design/
 18. https://dzone.com/articles/modern-queue-patterns-guide
 19. https://www.guvi.in/blog/build-a-command-line-interface-with-nodejs/
 20. https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues.
