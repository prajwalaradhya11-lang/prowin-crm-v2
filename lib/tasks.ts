import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  task_type: string | null;
  status: string | null;
  visibility: string | null;
  related_id: string | null;
  related_name: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_by_id: string | null;
  assigned_by_name: string | null;
  created_at?: string | null;
};

/** Combine separate date + time columns into one Date for display/filtering. */
export function taskDueDateTime(task: Pick<TaskRow, 'due_date' | 'due_time'>): Date | null {
  if (!task.due_date) return null;
  const timePart = (task.due_time ?? '09:00:00').slice(0, 8);
  try {
    return parseISO(`${task.due_date}T${timePart}`);
  } catch {
    return parseISO(`${task.due_date}T09:00:00`);
  }
}

export function formatTaskDue(task: TaskRow): string {
  const d = taskDueDateTime(task);
  if (!d) return '';
  if (isToday(d)) return `Today 뿯½ ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Tomorrow 뿯½ ${format(d, 'HH:mm')}`;
  return format(d, 'EEE d MMM 뿯½ HH:mm');
}

export function isTaskOverdue(task: TaskRow): boolean {
  const d = taskDueDateTime(task);
  if (!d) return false;
  const status = (task.status ?? '').toLowerCase();
  return isPast(d) && status !== 'done' && status !== 'completed';
}

export function isTaskDone(task: TaskRow): boolean {
  const status = (task.status ?? '').toLowerCase();
  return status === 'done' || status === 'completed';
}

export function mapTaskTypeToDb(type: string): string {
  if (type === 'meeting') return 'Meeting';
  if (type === 'event') return 'Event';
  return 'Task';
}

export function mapTaskTypeFromDb(taskType: string | null): string {
  const t = (taskType ?? 'Task').toLowerCase();
  if (t === 'meeting') return 'meeting';
  if (t === 'event') return 'event';
  return 'task';
}

/** Normalize HH:MM or HH:MM:SS to HH:MM:SS for Postgres time column. */
export function normalizeDueTime(time: string): string {
  const parts = time.trim().split(':');
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const sec = parts[2]?.padStart(2, '0') ?? '00';
    return `${h}:${m}:${sec}`;
  }
  return '09:00:00';
}

export function formatDueTime12h(time: string | null): string {
  if (!time) return '9:00 AM';
  const d = parseISO(`2000-01-01T${normalizeDueTime(time)}`);
  return format(d, 'h:mm a');
}
