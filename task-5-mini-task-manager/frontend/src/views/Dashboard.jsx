/**
 * ARCHITECTURAL NOTE — Dashboard, Split Sidebar & RBAC State
 * ===========================================================
 * The backend now returns { owned_projects, assigned_projects } from
 * GET /projects/. This component maps that split directly to two sidebar
 * sections and tracks which type of project is currently selected so that
 * child components receive the correct access flags:
 *
 *   selectedIsOwner = true  → full Kanban controls (edit, delete, arrows)
 *   selectedIsOwner = false → read-only board; only own assigned tasks get
 *                             status arrows; all others show a lock icon
 *
 * STATUS CHANGES:
 *   All Kanban arrow clicks call PATCH /tasks/{id}/status — the dedicated
 *   RBAC endpoint — rather than the full PUT /tasks/{id}. This ensures the
 *   server enforces Rule A/B regardless of what the frontend sends.
 *
 * CURRENT USER IDENTITY:
 *   `user` from AuthContext is the object returned by GET /auth/me. Its
 *   `id` field is passed down to KanbanBoard → TaskCard so each card can
 *   independently compute whether the current user is the task assignee
 *   (task.assignee_id === currentUserId), mirroring the backend's Rule B.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import KanbanBoard from '../components/KanbanBoard';
import Navbar from '../components/Navbar';
import TaskModal from '../components/TaskModal';
import { api } from '../hooks/useApi';

export default function Dashboard() {
  // `user` carries the authenticated user object ({ id, email, full_name }).
  // Its `id` is forwarded to TaskCard for the Rule B (assignee) check.
  const { user } = useAuth();

  // Owned projects (full access) and assigned projects (scoped access)
  // are stored separately so the sidebar renders two distinct sections.
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [assignedProjects, setAssignedProjects] = useState([]);

  // The currently selected project and whether the current user owns it.
  // `selectedIsOwner` gates "New Task", edit, and delete controls everywhere.
  const [selected, setSelected] = useState(null);
  const [selectedIsOwner, setSelectedIsOwner] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [taskModal, setTaskModal] = useState({ open: false, task: null });
  const [newTitle, setNewTitle] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Load projects on mount.
  // The new API response shape is { owned_projects: [...], assigned_projects: [...] },
  // which maps directly to the two sidebar sections.
  useEffect(() => {
    api
      .get('/projects/')
      .then(({ owned_projects, assigned_projects }) => {
        setOwnedProjects(owned_projects);
        setAssignedProjects(assigned_projects);
      })
      .catch(console.error);
  }, []);

  // Load tasks whenever the selected project changes.
  // GET /projects/{id}/tasks now accepts both owners and task assignees
  // (see _get_accessible_project in the backend tasks router).
  const loadTasks = useCallback(async (projectId) => {
    setLoadingTasks(true);
    try {
      setTasks(await api.get(`/projects/${projectId}/tasks`));
    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadTasks(selected.id);
    else setTasks([]);
  }, [selected, loadTasks]);

  // Sets the selected project and records whether the current user is its owner.
  // `isOwner` is forwarded through KanbanBoard → TaskCard to gate controls.
  const selectProject = (project, isOwner) => {
    setSelected(project);
    setSelectedIsOwner(isOwner);
  };

  // ── Project actions ─────────────────────────────────────────────────────
  const createProject = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const p = await api.post('/projects/', { title: newTitle.trim() });
      // New projects are always owned by the current user
      setOwnedProjects((prev) => [...prev, p]);
      selectProject(p, true);
      setNewTitle('');
      setShowNewProject(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setOwnedProjects((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setTasks([]);
        setSelectedIsOwner(false);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Task actions ─────────────────────────────────────────────────────────
  const handleTaskSave = (savedTask, isNew) => {
    setTasks((prev) =>
      isNew ? [...prev, savedTask] : prev.map((t) => (t.id === savedTask.id ? savedTask : t))
    );
    setTaskModal({ open: false, task: null });
  };

  const handleTaskDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Status changes go through PATCH /tasks/{id}/status — the RBAC endpoint.
  // The backend independently enforces Rule A (owner) and Rule B (assignee),
  // so a 403 here means the frontend's canChangeStatus logic drifted from
  // the backend's authorisation state (e.g., the user was unassigned remotely).
  const handleStatusChange = async (id, newStatus) => {
    try {
      const updated = await api.patch(`/tasks/${id}/status`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Local filter ──────────────────────────────────────────────────────────
  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter ? t.status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 gap-1 shrink-0 overflow-y-auto">

          {/* ── PROJECTS section (owned) ──────────────────────────────────── */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={() => setShowNewProject((v) => !v)}
              title="New project"
              className="text-blue-600 hover:text-blue-800 text-xl font-bold leading-none transition-colors"
            >
              +
            </button>
          </div>

          {/* Inline new-project form — only appears in the owned section */}
          {showNewProject && (
            <form onSubmit={createProject} className="mb-2">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Project name"
                maxLength={200}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm mb-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white text-xs rounded-lg py-1.5 hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewProject(false); setNewTitle(''); }}
                  className="flex-1 bg-gray-100 text-gray-600 text-xs rounded-lg py-1.5 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {ownedProjects.length === 0 && !showNewProject && (
            <p className="text-xs text-gray-400 mt-1 mb-3">No projects yet. Hit + to create one.</p>
          )}

          {ownedProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => selectProject(p, true)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                selected?.id === p.id && selectedIsOwner
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="text-sm font-medium truncate">{p.title}</span>
              {/* Delete is only available for owned projects */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                title="Delete project"
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-xs ml-1 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}

          {/* ── ASSIGNED PROJECTS section ─────────────────────────────────── */}
          {/* Rendered only when the backend reports at least one assigned project */}
          {assignedProjects.length > 0 && (
            <>
              <div className="mt-6 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Assigned Projects
                </span>
              </div>

              {assignedProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectProject(p, false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                    selected?.id === p.id && !selectedIsOwner
                      ? 'bg-purple-50 text-purple-700'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <span className="text-sm font-medium truncate">{p.title}</span>
                  {/* Visual cue that this is a scoped-access project */}
                  <span
                    title="You are assigned to a task in this project"
                    className="text-gray-300 text-xs ml-1 shrink-0 opacity-60"
                  >
                    👤
                  </span>
                </div>
              ))}
            </>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          {selected ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-bold text-gray-800 truncate">{selected.title}</h1>
                  {/* "Assignee view" badge makes the access scope immediately visible */}
                  {!selectedIsOwner && (
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 shrink-0 font-medium">
                      Assignee view
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Search tasks…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                  {/* "New Task" and the TaskModal are exclusively for project owners */}
                  {selectedIsOwner && (
                    <button
                      onClick={() => setTaskModal({ open: true, task: null })}
                      className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      + New Task
                    </button>
                  )}
                </div>
              </div>

              {/* Kanban board */}
              {loadingTasks ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Loading tasks…
                </div>
              ) : (
                <KanbanBoard
                  tasks={filtered}
                  // onEditTask / onDeleteTask are null for assigned projects —
                  // TaskCard checks these alongside isOwner to hide the controls.
                  onEditTask={selectedIsOwner ? (t) => setTaskModal({ open: true, task: t }) : null}
                  onDeleteTask={selectedIsOwner ? handleTaskDelete : null}
                  onStatusChange={handleStatusChange}
                  isOwner={selectedIsOwner}
                  currentUserId={user?.id}
                />
              )}
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4 select-none">📋</div>
                <p className="text-base font-medium">Select a project to view its board</p>
                <p className="text-sm mt-1">or click + in the sidebar to create one</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Task modal — owner-gated; assignees never open this dialog */}
      {taskModal.open && selectedIsOwner && (
        <TaskModal
          task={taskModal.task}
          projectId={selected?.id}
          onSave={handleTaskSave}
          onClose={() => setTaskModal({ open: false, task: null })}
        />
      )}
    </div>
  );
}
