import { format } from 'date-fns';
import { supabase } from './supabase';
import { isArchiveLeadStatus } from './leadFields';
import { fetchActiveCallStatusOptions, type CallStatusOption } from './callStatusOptions';
import { scheduleTaskReminder } from './notifications';
import type { CallOutcomeId } from './leadLogCallSheet';
import { outcomeToDispositionName } from './leadLogCallSheet';

export type LeadSheetSaveInput = {
  leadId: string;
  leadName: string;
  mode: 'log-call' | 'change-status';
  doneBy: string;
  agentId: string | null;
  agentName: string;
  current: {
    status: string;
    statusReason: string | null;
    interest: string;
    followUpDate: string | null;
    followUpTime: string | null;
    isArchived: boolean;
    project: string | null;
    bedrooms: string | null;
    budget: unknown;
    propertyType: string | null;
    purpose: string | null;
    communities: string | null;
  };
  status: string;
  statusReason: string | null;
  interest: string;
  followUpAt: Date | null;
  note: string;
  callOutcome: CallOutcomeId | null;
  durationSeconds: number;
  requirementUpdates: {
    project: string;
    bedrooms: string;
    budget: string;
    propertyType: string;
    purpose: string;
  };
};

type ActivityInsert = {
  lead_id: string;
  activity_type: string;
  note?: string | null;
  done_by: string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
};

function formatBool(v: boolean): string {
  return v ? 'Yes' : 'No';
}

async function resolveDispositionMapping(
  dispositionName: string | null,
): Promise<CallStatusOption | null> {
  if (!dispositionName) return null;
  const options = await fetchActiveCallStatusOptions();
  const exact = options.find(o => o.name === dispositionName);
  if (exact) return exact;
  const lower = dispositionName.toLowerCase();
  return options.find(o => o.name.toLowerCase() === lower) ?? null;
}

export async function saveLeadSheetUpdate(input: LeadSheetSaveInput): Promise<void> {
  const now = new Date().toISOString();
  const activities: ActivityInsert[] = [];
  const updates: Record<string, unknown> = {};

  const oldStatus = input.current.status;
  const newStatus = input.status.trim();
  const archiveFromStatus = isArchiveLeadStatus(newStatus);

  let shouldArchive = archiveFromStatus || input.current.isArchived;

  if (input.mode === 'log-call' && input.callOutcome) {
    const dispositionName = outcomeToDispositionName(input.callOutcome);
    const mapping = await resolveDispositionMapping(dispositionName);
    if (mapping?.archives_lead === true) {
      shouldArchive = true;
    }
  }

  if (newStatus && newStatus !== oldStatus) {
    updates.lead_status = newStatus;
    updates.status = newStatus;
    activities.push({
      lead_id: input.leadId,
      activity_type: 'status_changed',
      note: `Status changed: ${oldStatus || '(none)'} → ${newStatus}`,
      done_by: input.doneBy,
      field_changed: 'Lead Status',
      old_value: oldStatus || '—',
      new_value: newStatus,
      created_at: now,
    });
  }

  const oldReason = input.current.statusReason;
  const newReason = input.statusReason?.trim() || null;
  if (newReason !== oldReason) {
    updates.status_reason = newReason;
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      note: `Status reason: ${oldReason || '(none)'} → ${newReason || '(none)'}`,
      done_by: input.doneBy,
      field_changed: 'Status Reason',
      old_value: oldReason,
      new_value: newReason,
      created_at: now,
    });
  }

  const oldInterest = input.current.interest;
  if (input.interest !== oldInterest) {
    updates.priority = input.interest;
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      note: `Interest: ${oldInterest} → ${input.interest}`,
      done_by: input.doneBy,
      field_changed: 'Interest',
      old_value: oldInterest,
      new_value: input.interest,
      created_at: now,
    });
  }

  if (shouldArchive && !input.current.isArchived) {
    updates.is_archived = true;
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      note: 'Lead archived',
      done_by: input.doneBy,
      field_changed: 'Archived',
      old_value: formatBool(false),
      new_value: formatBool(true),
      created_at: now,
    });
  }

  if (input.followUpAt) {
    const dateStr = format(input.followUpAt, 'yyyy-MM-dd');
    const timeStr = format(input.followUpAt, 'HH:mm');
    const timeNorm = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    const oldFollow = input.current.followUpDate
      ? `${input.current.followUpDate}${input.current.followUpTime ? ` ${input.current.followUpTime}` : ''}`
      : null;
    const newFollow = `${dateStr} ${timeStr}`;
    if (dateStr !== input.current.followUpDate || timeNorm !== (input.current.followUpTime ?? null)) {
      updates.follow_up_date = dateStr;
      updates.follow_up_time = timeNorm;
      activities.push({
        lead_id: input.leadId,
        activity_type: 'field_changed',
        note: `Follow-up scheduled: ${newFollow}`,
        done_by: input.doneBy,
        field_changed: 'Follow Up',
        old_value: oldFollow,
        new_value: newFollow,
        created_at: now,
      });
    }
  }

  const req = input.requirementUpdates;
  const projectVal = req.project.trim() || null;
  if (projectVal && projectVal !== (input.current.communities ?? input.current.project ?? '')) {
    updates.communities = projectVal;
    updates.project = projectVal;
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      done_by: input.doneBy,
      field_changed: 'Project',
      old_value: input.current.communities ?? input.current.project,
      new_value: projectVal,
      created_at: now,
    });
  }
  if (req.bedrooms.trim() && req.bedrooms.trim() !== (input.current.bedrooms ?? '')) {
    updates.bedrooms = req.bedrooms.trim();
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      done_by: input.doneBy,
      field_changed: 'Bedrooms',
      old_value: input.current.bedrooms,
      new_value: req.bedrooms.trim(),
      created_at: now,
    });
  }
  if (req.budget.trim()) {
    const budgetNum = Number(req.budget.replace(/,/g, ''));
    const budgetVal = Number.isNaN(budgetNum) ? req.budget.trim() : budgetNum;
    if (String(budgetVal) !== String(input.current.budget ?? '')) {
      updates.budget = budgetVal;
      activities.push({
        lead_id: input.leadId,
        activity_type: 'field_changed',
        done_by: input.doneBy,
        field_changed: 'Budget',
        old_value: input.current.budget != null ? String(input.current.budget) : null,
        new_value: String(budgetVal),
        created_at: now,
      });
    }
  }
  if (req.propertyType.trim() && req.propertyType.trim() !== (input.current.propertyType ?? '')) {
    updates.property_type = req.propertyType.trim();
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      done_by: input.doneBy,
      field_changed: 'Property Type',
      old_value: input.current.propertyType,
      new_value: req.propertyType.trim(),
      created_at: now,
    });
  }
  if (req.purpose.trim() && req.purpose.trim() !== (input.current.purpose ?? '')) {
    updates.purpose = req.purpose.trim();
    activities.push({
      lead_id: input.leadId,
      activity_type: 'field_changed',
      done_by: input.doneBy,
      field_changed: 'Purpose',
      old_value: input.current.purpose,
      new_value: req.purpose.trim(),
      created_at: now,
    });
  }

  const trimmedNote = input.note.trim();
  if (trimmedNote) {
    activities.push({
      lead_id: input.leadId,
      activity_type: 'note_added',
      note: trimmedNote,
      done_by: input.doneBy,
      created_at: now,
    });
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', input.leadId);
    if (updateErr) throw updateErr;
  }

  if (input.mode === 'log-call') {
    const outcomeLabel = input.callOutcome
      ? outcomeToDispositionName(input.callOutcome) ?? 'Call'
      : 'Call';
    const { error: logErr } = await supabase.from('call_logs').insert({
      agent_id: input.agentId,
      agent_name: input.agentName,
      call_start_time: now,
      call_end_time: now,
      duration_seconds: input.durationSeconds,
      call_result: outcomeLabel,
      interest_level: input.interest,
      notes: trimmedNote || null,
      follow_up_date: input.followUpAt ? format(input.followUpAt, 'yyyy-MM-dd') : null,
    });
    if (logErr) throw logErr;

    activities.push({
      lead_id: input.leadId,
      activity_type: 'Call logged',
      note: `Call logged: ${outcomeLabel} (${Math.round(input.durationSeconds / 60)}m)`,
      done_by: input.doneBy,
      created_at: now,
    });
  }

  if (activities.length > 0) {
    const { error: actErr } = await supabase.from('lead_activities').insert(activities);
    if (actErr) throw actErr;
  }

  if (input.followUpAt && input.followUpAt.getTime() > Date.now()) {
    const dateStr = format(input.followUpAt, 'yyyy-MM-dd');
    const timeNorm = `${format(input.followUpAt, 'HH:mm')}:00`;
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        title: `Follow up: ${input.leadName}`,
        task_type: 'Task',
        due_date: dateStr,
        due_time: timeNorm,
        status: 'Pending',
        assigned_to_id: input.agentId,
        assigned_to_name: input.agentName,
        related_module: 'leads',
        related_id: input.leadId,
        related_name: input.leadName,
      })
      .select('id')
      .single();
    if (taskErr) throw taskErr;
    if (task?.id) {
      await scheduleTaskReminder(task.id, `Follow up: ${input.leadName}`, input.followUpAt, 30);
    }
  }
}

export async function prefetchStatusFromOutcome(
  outcomeId: CallOutcomeId,
): Promise<{ status: string | null; archivesLead: boolean }> {
  const dispositionName = outcomeToDispositionName(outcomeId);
  const mapping = await resolveDispositionMapping(dispositionName);
  if (!mapping) return { status: null, archivesLead: false };
  if (mapping.archives_lead) {
    return { status: null, archivesLead: true };
  }
  return {
    status: mapping.maps_to_status?.trim() || null,
    archivesLead: false,
  };
}
