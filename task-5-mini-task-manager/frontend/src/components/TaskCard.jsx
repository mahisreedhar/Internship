const STATUS_ORDER = ['To Do', 'In Progress', 'Done'];

const STATUS_BADGE = {
  'To Do': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Done: 'bg-emerald-100 text-emerald-700',
};

export default function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const idx = STATUS_ORDER.indexOf(task.status);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-800 text-sm leading-snug break-words min-w-0">
          {task.title}
        </h3>
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
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{task.description}</p>
      )}

      {/* Assignee avatar */}
      {task.assignee && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
            {task.assignee.full_name.charAt(0).toUpperCase()}
          </span>
          <span className="text-xs text-gray-500 truncate">{task.assignee.full_name}</span>
        </div>
      )}

      {/* Status badge + navigation arrows */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_BADGE[task.status]}`}>
          {task.status}
        </span>
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
      </div>
    </div>
  );
}
