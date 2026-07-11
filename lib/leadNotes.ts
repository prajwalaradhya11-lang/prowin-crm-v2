import type { LeadActivity } from './leadActivities';
import { getDateGroupLabel, formatTimestamp } from './leadEnquiry';

export type NoteItem = {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  dateGroup: string;
  timeLabel: string;
};

export function extractNotesFromActivities(activities: LeadActivity[]): NoteItem[] {
  return activities
    .filter(act => {
      const type = (act.activity_type ?? '').toLowerCase();
      return type.includes('note') && act.note?.trim();
    })
    .map(act => {
      const ts = act.created_at ?? new Date().toISOString();
      return {
        id: act.id,
        text: act.note!.trim(),
        author: act.done_by?.trim() || 'Unknown',
        timestamp: ts,
        dateGroup: getDateGroupLabel(ts),
        timeLabel: formatTimestamp(ts),
      };
    });
}

export function groupNotesByDate(notes: NoteItem[]): { label: string; items: NoteItem[] }[] {
  const map = new Map<string, NoteItem[]>();
  for (const note of notes) {
    const list = map.get(note.dateGroup) ?? [];
    list.push(note);
    map.set(note.dateGroup, list);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}
