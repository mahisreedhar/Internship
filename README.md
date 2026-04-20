

This repository is organized as a monorepo so multiple internship tasks can live in one place.

## Tasks

1. `task-1-quote-of-the-day`
2. `task-2-notes-app`
3. `task-3-auth-system`

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

## Task 2: Simple Notes Manager

Project structure:

```text
task-2-notes-app/
├── backend/
└── frontend/
```

Run backend:

```bash
cd task-2-notes-app/backend
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run frontend:

```bash
cd task-2-notes-app/frontend
npm install
npm run dev -- --host localhost --port 5174
```

## Task 3: Authentication Mini-System

Project structure:

```text
task-3-auth-system/
├── backend/
└── frontend/
```

Backend highlights:
- User signup and login
- Password hashing with `passlib` (`bcrypt`)
- JWT-based authentication with `PyJWT`
- Protected `/api/users/me` endpoint

Frontend highlights:
- React + TypeScript auth UI (`/login`, `/signup`, `/dashboard`)
- Token storage in `localStorage`
- Protected route behavior for dashboard
- Auto-logout redirect on invalid/expired token

Run backend:

```bash
cd task-3-auth-system/backend
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run frontend:

```bash
cd task-3-auth-system/frontend
npm install
npm run dev -- --host localhost --port 5174
```
