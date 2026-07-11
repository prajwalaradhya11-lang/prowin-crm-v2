import { format, isToday, isYesterday, parseISO } from 'date-fns';

export type EnquiryEntry = {
  id: string;
  campaign: string;
  source: string;
  date: string;
  isLatest: boolean;
  isFirst: boolean;
};

const CAMPAIGN_DISPLAY: Record<string, string> = {
  fb_lead_gen: 'Facebook Lead Gen',
  facebook: 'Facebook Lead Gen',
  google_ads: 'Google Ads',
  google: 'Google Ads',
  bayut: 'Bayut',
  propertyfinder: 'Property Finder',
  cold_call: 'Cold Call List',
  direct: 'Direct Enquiry',
};

export function formatCampaignDisplayName(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Direct Enquiry';
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (CAMPAIGN_DISPLAY[key]) return CAMPAIGN_DISPLAY[key];
  return raw.trim();
}

/** Stub enquiry timeline — real phone-matching backend comes later. */
export function buildStubEnquiries(lead: {
  id: string;
  created_at?: string | null;
  campaign_name?: string | null;
  lead_source?: string | null;
  source?: string | null;
  sub_source?: string | null;
}): EnquiryEntry[] {
  const source = (lead.lead_source ?? lead.source ?? 'Direct').trim();
  const campaign = formatCampaignDisplayName(lead.campaign_name ?? source);
  const created = lead.created_at ?? new Date().toISOString();

  const entries: EnquiryEntry[] = [
    {
      id: `${lead.id}-first`,
      campaign,
      source,
      date: created,
      isLatest: true,
      isFirst: true,
    },
  ];

  // Sample re-enquiry data for demo when source suggests paid channels
  const srcLower = source.toLowerCase();
  if (srcLower.includes('facebook') || srcLower.includes('google') || srcLower.includes('bayut')) {
    const earlier = new Date(created);
    earlier.setDate(earlier.getDate() - 14);
    entries.unshift({
      id: `${lead.id}-latest`,
      campaign: formatCampaignDisplayName(lead.campaign_name ?? `${source} Retarget`),
      source,
      date: created,
      isLatest: true,
      isFirst: false,
    });
    entries[1] = { ...entries[1], isLatest: false, isFirst: true };
  }

  return entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function formatEnquiryDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, 'd MMM yyyy · h:mm a');
  } catch {
    return iso;
  }
}

export type LeadFieldRow = { label: string; value: string };

export function buildPropertyRequirementRows(lead: {
  project?: string | null;
  communities?: string | null;
  area?: string | null;
  bedrooms?: string | null;
  budget?: unknown;
  min_budget?: unknown;
  max_budget?: unknown;
  property_type?: string | null;
  purpose?: string | null;
  timeline?: string | null;
  nationality?: string | null;
}): LeadFieldRow[] {
  const rows: LeadFieldRow[] = [];
  const project = (lead.project ?? lead.communities ?? lead.area ?? '').trim();
  if (project) rows.push({ label: 'Project', value: project });
  if (lead.bedrooms?.trim()) rows.push({ label: 'Beds', value: lead.bedrooms.trim() });
  const budget = formatBudget(lead.budget ?? lead.max_budget ?? lead.min_budget);
  if (budget) rows.push({ label: 'Budget', value: budget });
  if (lead.property_type?.trim()) rows.push({ label: 'Property type', value: lead.property_type.trim() });
  if (lead.purpose?.trim()) rows.push({ label: 'Purpose', value: lead.purpose.trim() });
  if (lead.timeline?.trim()) rows.push({ label: 'Timeline', value: lead.timeline.trim() });
  if (lead.nationality?.trim()) rows.push({ label: 'Nationality', value: lead.nationality.trim() });
  return rows;
}

export function buildLeadInfoRows(lead: {
  lead_number?: string | null;
  id?: string;
  purpose?: string | null;
  property_type?: string | null;
  created_at?: string | null;
}): LeadFieldRow[] {
  const rows: LeadFieldRow[] = [];
  const serial = lead.lead_number?.trim() || lead.id?.slice(0, 8).toUpperCase();
  if (serial) rows.push({ label: 'Serial no.', value: serial });
  const enquiredFor = lead.purpose?.trim() || lead.property_type?.trim();
  if (enquiredFor) rows.push({ label: 'Enquired for', value: enquiredFor });
  if (lead.created_at) {
    try {
      rows.push({ label: 'Created', value: format(parseISO(lead.created_at), 'd MMM yyyy') });
    } catch {
      rows.push({ label: 'Created', value: lead.created_at });
    }
  }
  return rows;
}

function formatBudget(value: unknown): string | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isNaN(n)) return n.toLocaleString('en-AE');
  return String(value);
}

export function getDateGroupLabel(iso: string | null | undefined): string {
  if (!iso) return 'Unknown date';
  try {
    const d = parseISO(iso);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, d MMM yyyy');
  } catch {
    return 'Unknown date';
  }
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '';
  }
}
