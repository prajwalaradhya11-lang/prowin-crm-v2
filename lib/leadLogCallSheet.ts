/** Statuses that require a future follow-up date + time before saving. */
export const FOLLOW_UP_REQUIRED_STATUSES = new Set([
  'Callback',
  'Follow Up',
  'Meeting Scheduled',
  'Pending',
  'EOI/Trail Closer',
]);

export const TERMINAL_STATUSES = new Set([
  'New',
  'Booked',
  'Invoiced',
  'Not Interested',
  'Dropped',
  'Booking Cancel',
  'Wrong Number',
  'Remove from Database',
]);

export const CALL_OUTCOME_OPTIONS = [
  { id: 'connected', label: 'Connected', dispositionName: 'Connected' },
  { id: 'no_answer', label: 'No answer', dispositionName: 'Attempted' },
  { id: 'busy', label: 'Busy', dispositionName: 'Attempted' },
  { id: 'switched_off', label: 'Switched off', dispositionName: 'Switched Off' },
  { id: 'wrong_number', label: 'Wrong number', dispositionName: 'Wrong Number' },
] as const;

export type CallOutcomeId = (typeof CALL_OUTCOME_OPTIONS)[number]['id'];

export function statusRequiresFollowUp(status: string): boolean {
  return FOLLOW_UP_REQUIRED_STATUSES.has(status.trim());
}

export function isFollowUpValid(status: string, followUpAt: Date | null): boolean {
  if (!statusRequiresFollowUp(status)) return true;
  if (!followUpAt) return false;
  return followUpAt.getTime() > Date.now();
}

export function followUpValidationHint(status: string): string {
  return `${status} needs a follow-up date & time`;
}

export function formatTalkDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s talk`;
  return `${mins}m ${secs}s talk`;
}

export function outcomeToDispositionName(outcomeId: CallOutcomeId | null): string | null {
  if (!outcomeId) return null;
  return CALL_OUTCOME_OPTIONS.find(o => o.id === outcomeId)?.dispositionName ?? null;
}
