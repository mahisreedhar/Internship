/**
 * TaskModal — Create / Edit Task Form
 * =====================================
 * This modal handles both creating a new task and editing an existing one.
 * The key change from the original version is the assignee field: the static
 * <select> dropdown (which fetched all users at mount) has been replaced with
 * <UserSearchCombobox>, an async autocomplete component that queries the
 * backend in real-time as the user types.
 *
 * EDIT MODE vs. CREATE MODE:
 *   - If the `task` prop is provided, the form pre-fills with existing values
 *     and submits a PUT /tasks/:id request.
 *   - If `task` is null/undefined, the form starts blank and submits a
 *     POST /projects/:projectId/tasks request.
 *
 * ASSIGNEE FIELD — HOW IT CONNECTS TO UserSearchCombobox:
 *   The combobox is a controlled component driven by two props:
 *     1. `initialName`: pre-fills the text input with the existing assignee's
 *        name in edit mode. Derived from `task?.assignee?.full_name`.
 *     2. `onSelect`: a callback that fires whenever the user picks a suggestion
 *        or clears the input. It receives either a numeric user ID or `null`.
 *        We wire it to `(id) => set('assignee_id', id)` so the parent form
 *        state is updated without any extra plumbing.
 *
 * Because the combobox manages its own suggestion fetching internally, this
 * component no longer needs a `users` state array or the useEffect that
 * previously called GET /auth/users at mount time.
 */
import { useState } from 'react';
import { api } from '../hooks/useApi';
import Modal from './Modal';
import UserSearchCombobox from './UserSearchCombobox';

const STATUSES = ['To Do', 'In Progress', 'Done'];

export default function TaskModal({ task, projectId, onSave, onClose }) {
  const isEditing = Boolean(task);

  // `assignee_id` is stored as a number (or null), not a string.
  // The UserSearchCombobox's onSelect callback always provides a numeric ID
  // or null — no parseInt conversion is needed here.
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'To Do',
    assignee_id: task?.assignee_id ?? null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Immutable field-setter: merges a single key update into the form state.
  // Using this pattern avoids stale-closure bugs that would arise from
  // direct setForm({ ...form, [key]: val }) calls inside async handlers.
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      // null is intentional — it means "unassigned". The backend schema marks
      // assignee_id as Optional[int], so null is safe and saves without error.
      assignee_id: form.assignee_id ?? null,
    };

    try {
      const saved = isEditing
        ? await api.put(`/tasks/${task.id}`, payload)
        : await api.post(`/projects/${projectId}/tasks`, payload);
      // `isEditing` is negated to signal whether this was a create operation.
      // The parent Dashboard uses this boolean to decide whether to append
      // the task to the list or replace an existing entry.
      onSave(saved, !isEditing);
    } catch (err) {
      setError(err.message ?? 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isEditing ? 'Edit Task' : 'New Task'} onClose={onClose}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={200}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Status — static <select> remains correct here because the set of
            valid statuses is small, fixed, and defined on the backend enum.
            There is no benefit to making this async. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Assignee — replaced static <select> with async autocomplete combobox.
            `initialName` pre-fills the input in edit mode from the task's nested
            assignee object. `onSelect` wires the combobox's ID output directly
            into our form state so the payload is always up to date. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
          <UserSearchCombobox
            initialName={task?.assignee?.full_name ?? ''}
            onSelect={(id) => set('assignee_id', id)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Task'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
