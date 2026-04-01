# LexMirror

This repository is organized as a monorepo so multiple internship tasks can live in one place.

## Tasks

1. `task-1-quote-of-the-day`

## Task 1: Quote of the Day

Project structure:

```text
task-1-quote-of-the-day/
├── backend/
└── frontend/
```

Run backend:

```bash
cd task-1-quote-of-the-day/backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run frontend:

```bash
cd task-1-quote-of-the-day/frontend
npm install
npm run dev -- --host localhost --port 5174
```
