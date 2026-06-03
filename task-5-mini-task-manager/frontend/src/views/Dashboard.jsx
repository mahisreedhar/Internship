import { useCallback, useEffect, useState } from 'react';
import KanbanBoard from '../components/KanbanBoard';
import Navbar from '../components/Navbar';
import TaskModal from '../components/TaskModal';
import { api } from '../hooks/useApi';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [taskModal, setTaskModal] = useState({ open: false, task: null });
  const [newTitle, setNewTitle] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Load all projects on mount
  useEffect(() => {
    api.get('/projects/').then(setProjects).catch(console.error);
  }, []);

  // Load tasks whenever the selected project changes
  const loadTasks = useCallback(async (projectId) => {
    setLoadingTasks(true);
    try {
      setTasks(await api.get(`/projects/${projectId}/tasks`));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadTasks(selected.id);
    else setTasks([]);
  }, [selected, loadTasks]);

  // ── Project actions ────────────────────────────────────────────────────────
  const createProject = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const p = await api.post('/projects/', { title: newTitle.trim() });
      setProjects((prev) => [...prev, p]);
      setSelected(p);
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
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) { setSelected(null); setTasks([]); }
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Task actions ───────────────────────────────────────────────────────────
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

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updated = await api.put(`/tasks/${id}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Local filter ───────────────────────────────────────────────────────────
  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter ? t.status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 gap-1 shrink-0">
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

          {/* New-project inline form */}
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

          {/* Project list */}
          {projects.length === 0 && !showNewProject && (
            <p className="text-xs text-gray-400 mt-2">No projects yet. Hit + to create one.</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                selected?.id === p.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="text-sm font-medium truncate">{p.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                title="Delete project"
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-xs ml-1 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          {selected ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
                <h1 className="text-xl font-bold text-gray-800 truncate">{selected.title}</h1>
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
                  <button
                    onClick={() => setTaskModal({ open: true, task: null })}
                    className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    + New Task
                  </button>
                </div>
              </div>

              {/* Kanban */}
              {loadingTasks ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Loading tasks…
                </div>
              ) : (
                <KanbanBoard
                  tasks={filtered}
                  onEditTask={(t) => setTaskModal({ open: true, task: t })}
                  onDeleteTask={handleTaskDelete}
                  onStatusChange={handleStatusChange}
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

      {/* Task create / edit modal */}
      {taskModal.open && (
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
