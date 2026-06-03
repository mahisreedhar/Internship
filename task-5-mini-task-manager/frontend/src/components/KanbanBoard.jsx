import TaskCard from './TaskCard';

const COLUMNS = [
  {
    status: 'To Do',
    border: 'border-slate-300',
    header: 'bg-slate-100 text-slate-700',
  },
  {
    status: 'In Progress',
    border: 'border-blue-300',
    header: 'bg-blue-50 text-blue-700',
  },
  {
    status: 'Done',
    border: 'border-emerald-300',
    header: 'bg-emerald-50 text-emerald-700',
  },
];

export default function KanbanBoard({ tasks, onEditTask, onDeleteTask, onStatusChange }) {
  return (
    <div className="flex gap-4 flex-1 overflow-x-auto pb-2">
      {COLUMNS.map(({ status, border, header }) => {
        const col = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className={`flex-1 min-w-64 rounded-xl border-2 ${border} flex flex-col overflow-hidden`}
          >
            {/* Column header */}
            <div className={`px-4 py-2.5 flex items-center justify-between ${header}`}>
              <span className="font-semibold text-sm">{status}</span>
              <span className="text-xs font-medium bg-white/60 rounded-full px-2 py-0.5">
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 flex flex-col gap-2 overflow-y-auto">
              {col.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6 select-none">
                  No tasks here
                </p>
              ) : (
                col.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => onEditTask(task)}
                    onDelete={() => onDeleteTask(task.id)}
                    onStatusChange={onStatusChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
