import { supabase } from './supabase';
import { isConnectedCallResult } from './callLog';
import type { LeadActivity } from './leadActivities';
import { getDateGroupLabel, formatTimestamp } from './leadEnquiry';

export type HistoryEventType = 'answered' | 'missed' | 'follow_up' | 'note' | 'other';

export type HistoryEvent = {
  id: string;
  type: HistoryEventType;
  title: string;
  subtitle?: string;
  note?: string;
  agentName?: string;
  timestamp: string;
  dateGroup: string;
};

export type HistoryStats = {
  calls: number;
  talkTimeMinutes: number;
  answered: number;
};

type CallLogRow = {
  id: string;
  call_result?: string | null;
  duration_seconds?: number | null;
  agent_name?: string | null;
  call_start_time?: string | null;
  created_at?: string | null;
  notes?: string | null;
};

export async function fetchCallLogsForLead(leadId: string): Promise<CallLogRow[]> {
  const { data: contacts } = await supabase
    .from('cold_call_contacts')
    .select('id')
    .eq('lead_id', leadId);

  const contactIds = (contacts ?? []).map(c => c.id);
  if (!contactIds.length) return [];

  const { data, error } = await supabase
    .from('call_logs')
    .select('id, call_result, duration_seconds, agent_name, call_start_time, created_at, notes')
    .in('contact_id', contactIds)
    .order('call_start_time', { ascending: false });

  if (error) {
    console.warn('[history] call_logs fetch', error.message);
    return [];
  }
  return (data ?? []) as CallLogRow[];
}

export function computeHistoryStats(logs: CallLogRow[]): HistoryStats {
  let talkSeconds = 0;
  let answered = 0;
  for (const log of logs) {
    talkSeconds += log.duration_seconds ?? 0;
    if (isConnectedCallResult(log.call_result)) answered += 1;
  }
  return {
    calls: logs.length,
    talkTimeMinutes: Math.round(talkSeconds / 60),
    answered,
  };
}

export function buildHistoryEvents(
  activities: LeadActivity[],
  callLogs: CallLogRow[],
): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const log of callLogs) {
    const ts = log.call_start_time ?? log.created_at ?? new Date().toISOString();
    const connected = isConnectedCallResult(log.call_result);
    events.push({
      id: `call-${log.id}`,
      type: connected ? 'answered' : 'missed',
      title: connected ? 'Answered call' : 'Missed / not connected',
      subtitle: log.call_result ?? undefined,
      note: log.notes?.trim() || undefined,
      agentName: log.agent_name ?? undefined,
      timestamp: ts,
      dateGroup: getDateGroupLabel(ts),
    });
  }

  for (const act of activities) {
    const ts = act.created_at ?? new Date().toISOString();
    const type = (act.activity_type ?? '').toLowerCase();
    const field = (act.field_changed ?? '').toLowerCase();

    if (type.includes('note') || type === 'note_added') {
      events.push({
        id: `act-${act.id}`,
        type: 'note',
        title: 'Note added',
        note: act.note?.trim() || undefined,
        agentName: act.done_by ?? undefined,
        timestamp: ts,
        dateGroup: getDateGroupLabel(ts),
      });
      continue;
    }

    if (field.includes('follow') || act.note?.toLowerCase().includes('follow-up')) {
      const oldVal = act.old_value?.trim();
      const newVal = act.new_value?.trim();
      events.push({
        id: `act-${act.id}`,
        type: 'follow_up',
        title: 'Follow-up rescheduled',
        subtitle: oldVal && newVal ? `${oldVal} → ${newVal}` : act.note ?? undefined,
        agentName: act.done_by ?? undefined,
        timestamp: ts,
        dateGroup: getDateGroupLabel(ts),
      });
      continue;
    }

    if (type.includes('call')) {
      events.push({
        id: `act-${act.id}`,
        type: 'other',
        title: act.activity_type ?? 'Call activity',
        note: act.note?.trim() || undefined,
        agentName: act.done_by ?? undefined,
        timestamp: ts,
        dateGroup: getDateGroupLabel(ts),
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

export function groupHistoryByDate(events: HistoryEvent[]): { label: string; items: HistoryEvent[] }[] {
  const map = new Map<string, HistoryEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.dateGroup) ?? [];
    list.push(ev);
    map.set(ev.dateGroup, list);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export { formatTimestamp };
