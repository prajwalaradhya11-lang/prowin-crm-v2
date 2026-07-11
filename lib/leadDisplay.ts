import { format, isBefore, parseISO, startOfDay } from 'date-fns';

export type SourceIconName =
  | 'logo-facebook'
  | 'logo-google'
  | 'business-outline'
  | 'server-outline'
  | 'person-outline'
  | 'ellipse-outline';

export type SourceIconConfig = {
  name: SourceIconName;
  color: string;
  bg: string;
};

export function getLeadSourceRaw(lead: {
  lead_source?: string | null;
  source?: string | null;
  sub_source?: string | null;
}): string {
  return (lead.lead_source ?? lead.source ?? lead.sub_source ?? 'Direct').trim();
}

/** Map lead source to icon + colors (Tabler-style via Ionicons). */
export function getLeadSourceIconConfig(sourceRaw: string): SourceIconConfig {
  const s = sourceRaw.toLowerCase();

  if (s.includes('facebook') || s.includes('fb') || s.includes('meta')) {
    return { name: 'logo-facebook', color: '#2b6cb0', bg: '#eef4fc' };
  }
  if (s.includes('google') || s.includes('gads') || s.includes('adwords')) {
    return { name: 'logo-google', color: '#1a8f4e', bg: '#e9f7ef' };
  }
  if (s.includes('bayut') || s.includes('propertyfinder') || s.includes('property finder') || s.includes('dubizzle')) {
    return { name: 'business-outline', color: '#2b6cb0', bg: '#eef4fc' };
  }
  if (
    s.includes('cold') ||
    s.includes('data') ||
    s.includes('database') ||
    s.includes('import') ||
    s.includes('csv')
  ) {
    return { name: 'server-outline', color: '#8a8a8f', bg: '#f5f5f7' };
  }
  if (s.includes('direct') || s.includes('referral') || s.includes('walk')) {
    return { name: 'person-outline', color: '#8a8a8f', bg: '#f5f5f7' };
  }
  return { name: 'ellipse-outline', color: '#8a8a8f', bg: '#f5f5f7' };
}

export function getInterestPillStyle(interest: string): { bg: string; text: string; border: string } {
  if (interest === 'Hot') return { bg: '#fdf2f1', text: '#c0392b', border: '#f5d0cc' };
  if (interest === 'Warm') return { bg: '#fef3e0', text: '#b5791a', border: '#f5dfa8' };
  return { bg: '#eef4fc', text: '#2b6cb0', border: '#c5d9f5' };
}

export function getStatusAccentColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('booked') || s.includes('invoiced') || s.includes('meeting')) return '#1a8f4e';
  if (s.includes('callback') || s.includes('pending') || s.includes('eoi')) return '#b5791a';
  if (s.includes('not interested') || s.includes('dropped') || s.includes('cancel')) return '#8a8a8f';
  if (s.includes('new')) return '#2b6cb0';
  return '#c0392b';
}

export type FollowUpDisplay = {
  label: string;
  overdue: boolean;
};

export function getFollowUpDisplay(
  followUpDate?: string | null,
  followUpTime?: string | null,
): FollowUpDisplay {
  if (!followUpDate?.trim()) {
    return { label: 'No follow-up', overdue: false };
  }

  try {
    const iso = followUpTime?.trim()
      ? `${followUpDate}T${followUpTime}`
      : followUpDate;
    const d = parseISO(iso);
    const formatted = format(d, 'd MMM yyyy');
    const overdue = isBefore(startOfDay(d), startOfDay(new Date()));
    if (overdue) {
      return { label: `Overdue · ${formatted}`, overdue: true };
    }
    return { label: formatted, overdue: false };
  } catch {
    return { label: followUpDate, overdue: false };
  }
}

export function getLastNoteFromActivities(
  activities: Array<{ note?: string | null; activity_type?: string | null }>,
): string | null {
  for (const act of activities) {
    const note = act.note?.trim();
    if (!note) continue;
    const type = (act.activity_type ?? '').toLowerCase();
    if (type.includes('note') || note.length > 0) return note;
  }
  return null;
}
