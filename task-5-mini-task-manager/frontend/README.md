# Task Manager — Frontend

React 18 + Vite + Tailwind CSS. Communicates with the FastAPI backend exclusively via HttpOnly cookies (no localStorage token storage).

## How to Run

```bash
cd task-5-mini-task-manager/frontend

# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

The app is now at **http://localhost:5173**.  
Make sure the backend is running on port 8000 first.

## Production Build

```bash
npm run build     # outputs to dist/
npm run preview   # locally preview the production build
```

---

## Architecture & Security Deep-Dive

### `vite.config.js` — Dev Proxy

```
Browser → localhost:5173/api/auth/login
              ↓  (Vite proxy rewrites /api → "")
         localhost:8000/auth/login  (FastAPI)
              ↓
         Set-Cookie: access_token=…; HttpOnly; SameSite=Strict
              ↓  (cookie scoped to localhost:5173)
Browser stores cookie — JavaScript cannot read it
```

**Why proxy instead of direct cross-origin requests?**  
With a proxy, the browser treats all requests as same-origin (localhost:5173). This means:
1. No CORS preflight overhead on every request.
2. Cookies are scoped to the frontend origin — they're sent automatically with every proxied request.
3. In production, replicate this with nginx or by mounting the built frontend inside FastAPI via `StaticFiles`.

---

### `src/context/AuthContext.jsx` — Global Auth State

```
App boots
  └── AuthProvider mounts
        └── GET /api/auth/me
              ├── 200 OK  → setUser(data)   — cookie was valid
              └── 401     → setUser(null)   — not logged in
```

**Why not read from localStorage?**  
localStorage is readable by any JavaScript on the page — including scripts injected via XSS. The HttpOnly cookie approach means there is no token to steal from the DOM or JavaScript context. The `/auth/me` call is the only way to determine auth state, and it validates the token server-side on every page load.

**The `loading` flag:**  
Without it, a hard refresh would briefly render the login page before the `/auth/me` response arrives, causing a visible flash. The `loading` guard keeps child routes suspended until auth state is resolved.

---

### `src/hooks/useApi.js` — Centralised HTTP Client

All API calls go through one module, which enforces:
- `credentials: 'include'` on every request (sends the HttpOnly cookie)
- Consistent JSON error parsing (`{ detail: "..." }` → `{ status, message }`)
- 204 No Content guard (DELETE responses have no body — calling `.json()` would throw)

If you need to add auth headers, logging, or retry logic, there is exactly one place to do it.

---

### `src/App.jsx` — Route Guards

```
ProtectedRoute:  user === null → redirect to /login
PublicRoute:     user !== null → redirect to /  (no re-login after auth)
```

Both guards check `loading` first so they don't redirect prematurely during the initial `/auth/me` check.

---

### Component Architecture

```
Dashboard (view)
  ├── Navbar
  ├── Sidebar (project list)
  └── KanbanBoard
        └── TaskCard × N
              ├── Edit button → TaskModal (edit mode)
              ├── Delete button
              └── ← → status arrows → PUT /tasks/{id}

TaskModal (create or edit)
  └── Modal (base — handles Esc key + backdrop click to close)
```

**Local filter:**  
Search and status filter operate on the already-fetched `tasks` array in component state — no extra API calls. This keeps the UI instant and reduces backend load.

**Optimistic-ish updates:**  
After a successful API mutation the component state is updated immediately (no full re-fetch), so the UI reflects changes without waiting for a round-trip.

---

### File Map

```
src/
├── App.jsx                  Route definitions + auth guards
├── context/
│   └── AuthContext.jsx      Global user state + login/logout actions
├── hooks/
│   └── useApi.js            Fetch wrapper (credentials, error parsing)
├── components/
│   ├── Navbar.jsx           Top bar with user name + logout
│   ├── KanbanBoard.jsx      Three-column layout
│   ├── TaskCard.jsx         Card with status badge + ← → arrows
│   ├── Modal.jsx            Base modal (Esc / backdrop close)
│   └── TaskModal.jsx        Task create/edit form inside modal
└── views/
    ├── Login.jsx            Sign-in page
    ├── Signup.jsx           Registration page
    └── Dashboard.jsx        Main app shell (sidebar + board)
```
