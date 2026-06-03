/**
 * ARCHITECTURAL NOTE — TaskCard & RBAC Conditional Rendering
 * ===========================================================
 * TaskCard enforces the same access model as the backend, expressed visually:
 *
 *   isOwner = true
 *     → Full controls: edit (✎) and delete (✕) buttons appear on hover;
 *       status navigation arrows (← →) are always available.
 *
 *   isOwner = false, task.assignee_id === currentUserId  (Rule B)
 *     → Partial access: status arrows visible so the assignee can advance
 *       their own task. Edit and delete buttons are hidden because only
 *       the project owner may mutate task metadata.
 *
 *   isOwner = false, task.assignee_id !== currentUserId  (neither Rule A nor B)
 *     → Read-only: all interactive controls hidden. A lock icon replaces
 *       the status arrows and the card renders at reduced opacity to signal
 *       that it is not actionable for the current user.
 *
 * `canChangeStatus` mirrors the backend logic in PATCH /tasks/{id}/status
 * exactly. If the frontend and backend somehow diverge (e.g., a user is
 * unassigned remotely while viewing the board), clicking an arrow that
 * `canChangeStatus` incorrectly shows would still receive a 403 from the
 * server — the backend is the authoritative enforcement point.
 */

const STATUS_ORDER = ['To Do', 'In Progress', 'Done'];

const STATUS_BADGE = {
  'To Do': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Done: 'bg-emerald-100 text-emerald-700',
};

/**
 * Inline SVG padlock — shown on read-only cards to signal that the
 * current user is not authorised to change this task's status.
 * Using an SVG (not an emoji) gives us consistent sizing and colour control.
 */
function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="w-3.5 h-3.5 text-gray-400"
      aria-label="Read-only: you are not authorised to update this task's status"
    >
      <path
        fillRule="evenodd"
        d="M8 1a3 3 0 0 0-3 3v1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm2 4V4a2 2 0 1 0-4 0v1h4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  isOwner,
  currentUserId,
}) {
  const idx = STATUS_ORDER.indexOf(task.status);

  /**
   * Mirrors the backend's RBAC rules for PATCH /tasks/{id}/status:
   *   Rule A: project owner → can change any task's status.
   *   Rule B: task assignee (non-owner) → can only change their own task's status.
   *
   * `task.assignee_id` is the integer user ID stored on the task row.
   * `currentUserId` is extracted from the /auth/me response in AuthContext.
   * Strict equality (===) is used because both are integers — no coercion needed.
   */
  const canChangeStatus = isOwner || task.assignee_id === currentUserId;

  return (
    <div
      className={`bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group ${
        canChangeStatus
          ? 'border-gray-200'
          : 'border-gray-100 opacity-75'  // dimmed to visually indicate read-only
      }`}
    >
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-800 text-sm leading-snug break-words min-w-0">
          {task.title}
        </h3>

        {/*
          Edit and delete controls are only rendered for project owners.
          `isOwner && onEdit && onDelete` guards against null callbacks that
          Dashboard passes when viewing an assigned project.
        */}
        {isOwner && onEdit && onDelete && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              title="Edit task"
              className="text-gray-400 hover:text-blue-500 text-xs p-0.5 transition-colors"
            >
              ✎
            </button>
            <button
              onClick={onDelete}
              title="Delete task"
              className="text-gray-400 hover:text-red-500 text-xs p-0.5 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      {task.description && (
        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{task.description}</p>
      )}

      {/* ── Assignee avatar ──────────────────────────────────────────────── */}
      {task.assignee && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
            {task.assignee.full_name.charAt(0).toUpperCase()}
          </span>
          <span className="text-xs text-gray-500 truncate">{task.assignee.full_name}</span>
        </div>
      )}

      {/* ── Status badge + interactive controls ─────────────────────────── */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_BADGE[task.status]}`}>
          {task.status}
        </span>

        {canChangeStatus ? (
          /*
           * Status navigation arrows — shown when the user may change this
           * task's status (either as project owner or as the task's assignee).
           * Clicks call onStatusChange which POSTs to PATCH /tasks/{id}/status
           * where the server re-validates the RBAC rules independently.
           */
          <div className="flex gap-1">
            {idx > 0 && (
              <button
                onClick={() => onStatusChange(task.id, STATUS_ORDER[idx - 1])}
                title={`Move to "${STATUS_ORDER[idx - 1]}"`}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 transition-colors"
              >
                ←
              </button>
            )}
            {idx < STATUS_ORDER.length - 1 && (
              <button
                onClick={() => onStatusChange(task.id, STATUS_ORDER[idx + 1])}
                title={`Move to "${STATUS_ORDER[idx + 1]}"`}
                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded px-1.5 py-0.5 transition-colors"
              >
                →
              </button>
            )}
          </div>
        ) : (
          /*
           * Lock icon — replaces the arrows on cards the current user is not
           * authorised to move. The tooltip text explains why the card is
           * read-only without requiring additional visual real estate.
           */
          <span title="You are not authorised to update this task's status">
            <LockIcon />
          </span>
        )}
      </div>
    </div>
  );
}
