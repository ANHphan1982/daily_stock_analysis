import type React from 'react';
import { Card as ShadCard, CardHeader, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { DashboardPanelHeader } from '../dashboard';
import type { TaskInfo } from '../../types/analysis';
import { cn } from '../../utils/cn';

interface TaskItemProps {
  task: TaskInfo;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const isProcessing = task.status === 'processing';
  const isPending    = task.status === 'pending';

  return (
    <div className="home-subpanel flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className="shrink-0">
          {isProcessing ? (
            <svg className="h-4 w-4 animate-spin text-cyan" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isPending ? (
            <svg className="h-4 w-4 text-muted-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : null}
        </div>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {task.stockName || task.stockCode}
            </span>
            <span className="text-xs text-muted-text shrink-0">{task.stockCode}</span>
          </div>
          {task.message ? (
            <p className="text-xs text-secondary-text truncate mt-0.5">{task.message}</p>
          ) : null}
        </div>

        {/* Status badge */}
        <Badge
          variant={isProcessing ? 'default' : 'secondary'}
          className={cn(
            'shrink-0 text-[10px] px-2 py-0.5 rounded-full',
            isProcessing && 'bg-cyan/15 text-cyan border-cyan/20',
          )}
        >
          {isProcessing ? 'Đang chạy' : 'Chờ'}
        </Badge>
      </div>

      {/* Progress bar — indeterminate for processing, empty for pending */}
      <Progress
        value={isProcessing ? undefined : 0}
        className={cn(
          'h-1',
          isProcessing
            ? '[&>[data-slot=progress-indicator]]:animate-[progress-indeterminate_1.4s_ease-in-out_infinite] [&>[data-slot=progress-indicator]]:bg-cyan'
            : 'opacity-30',
        )}
      />
    </div>
  );
};

interface TaskPanelProps {
  tasks: TaskInfo[];
  visible?: boolean;
  title?: string;
  className?: string;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  tasks,
  visible = true,
  title = 'Tác vụ phân tích',
  className = '',
}) => {
  const activeTasks     = tasks.filter((t) => t.status === 'pending' || t.status === 'processing');
  const pendingCount    = activeTasks.filter((t) => t.status === 'pending').length;
  const processingCount = activeTasks.filter((t) => t.status === 'processing').length;

  if (!visible || activeTasks.length === 0) return null;

  return (
    <ShadCard
      className={cn('home-panel-card gap-0 overflow-hidden rounded-2xl border-border/50 bg-card/80 shadow-soft-card', className)}
    >
      <CardHeader className="border-b border-subtle px-3 py-3">
        <DashboardPanelHeader
          className="mb-0"
          title={title}
          titleClassName="text-sm font-medium"
          leading={(
            <svg className="h-4 w-4 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          headingClassName="items-center"
          actions={(
            <div className="flex items-center gap-2 text-xs text-muted-text">
              {processingCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
                  {processingCount} đang chạy
                </span>
              )}
              {pendingCount > 0 ? <span>{pendingCount} chờ</span> : null}
            </div>
          )}
        />
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-64 overflow-y-auto">
          <div className="divide-y divide-border/30 p-2">
            {activeTasks.map((task, idx) => (
              <div key={task.taskId}>
                {idx > 0 && <Separator className="my-1 bg-border/20" />}
                <TaskItem task={task} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </ShadCard>
  );
};

export default TaskPanel;
