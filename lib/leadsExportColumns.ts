import type { ExportColumn } from './exportDownload';
import { getName } from './leadName';
import { getLeadPipelineStatus } from './leadFields';

function formatCreatedDate(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-GB');
}

type LeadExportRow = {
  lead_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  lead_status?: string | null;
  status?: string | null;
  assigned_agent_name?: string | null;
  campaign_name?: string | null;
  created_at?: string | null;
};

/** Mirrors web LEADS_EXPORT_COLUMNS headers. */
export const LEADS_EXPORT_COLUMNS: ExportColumn<LeadExportRow>[] = [
  { key: 'name', header: 'Name', value: (lead) => getName(lead) },
  { key: 'phone', header: 'Phone', value: (lead) => lead.phone ?? '' },
  { key: 'email', header: 'Email', value: (lead) => lead.email ?? '' },
  {
    key: 'status',
    header: 'Status',
    value: (lead) => getLeadPipelineStatus(lead),
  },
  {
    key: 'agent',
    header: 'Assigned Agent',
    value: (lead) => lead.assigned_agent_name ?? '',
  },
  {
    key: 'campaign',
    header: 'Campaign',
    value: (lead) => lead.campaign_name ?? '',
  },
  {
    key: 'createdAt',
    header: 'Created date',
    value: (lead) => formatCreatedDate(lead.created_at),
  },
];
