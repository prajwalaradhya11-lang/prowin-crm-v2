import { format, startOfMonth } from 'date-fns';
import { supabase } from './supabase';
import type { CrmUser } from '../hooks/useCrmSession';
import { getUserDisplayName } from '../hooks/useCrmSession';
import { resolveUserEmployeeId, isLeadAssignedToUser } from './rbac';
import {
  isConnectedCallResult,
  isProspectCallLog,
  type CallLogRow,
} from './callLog';

export type CrmUserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  photo_url: string | null;
};

export type AgentMtdStats = {
  connected: number;
  talkTimeSeconds: number;
  prospects: number;
  totalLeads: number;
  meetings: number;
  closings: number;
};

export type PipelineCounts = {
  newL: number;
  hot: number;
  warm: number;
  won: number;
};

export type ChampionEntry = {
  agentId: string;
  name: string;
  role: string;
  photo_url: string | null;
  value: number;
  displayValue: string;
} | null;

export type HomeDashboardData = {
  profile: CrmUserProfile | null;
  agentStats: AgentMtdStats;
  pipeline: PipelineCounts;
  champions: {
    revenue: ChampionEntry;
    talkTime: ChampionEntry;
    meetings: ChampionEntry;
  };
};

export function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Agent';
  return trimmed.split(/\s+/)[0] ?? 'Agent';
}

export function formatTalkTimeHms(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatAed(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function getMtdBounds(): { startIso: string; startDate: string; endIso: string } {
  const start = startOfMonth(new Date());
  return {
    startIso: start.toISOString(),
    startDate: format(start, 'yyyy-MM-dd'),
    endIso: new Date().toISOString(),
  };
}

function uniqueAgentIds(crmUserId: string | null, employeeId: string | null): string[] {
  const ids = new Set<string>();
  if (crmUserId) ids.add(crmUserId);
  if (employeeId) ids.add(employeeId);
  return [...ids];
}

function resolveCrmUserByTextAgentId(
  agentId: string,
  users: CrmUserProfile[],
): CrmUserProfile | null {
  return users.find(u => u.id === agentId) ?? null;
}

function pickChampion(
  totals: Map<string, number>,
  users: CrmUserProfile[],
  formatValue: (value: number) => string,
): ChampionEntry {
  const entries = [...totals.entries()].filter(([, value]) => value > 0);
  if (!entries.length) return null;

  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const nameA = resolveCrmUserByTextAgentId(a[0], users)?.name ?? a[0];
    const nameB = resolveCrmUserByTextAgentId(b[0], users)?.name ?? b[0];
    return nameA.localeCompare(nameB);
  });

  const [agentId, value] = entries[0];
  const profile = resolveCrmUserByTextAgentId(agentId, users);
  if (!profile) return null;

  return {
    agentId,
    name: profile.name,
    role: profile.role,
    photo_url: profile.photo_url,
    value,
    displayValue: formatValue(value),
  };
}

async function fetchActiveCrmUsers(): Promise<CrmUserProfile[]> {
  const { data, error } = await supabase
    .from('crm_users')
    .select('id, name, email, role, phone, photo_url')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name ?? row.email ?? 'Agent',
    email: row.email ?? '',
    role: row.role ?? 'agent',
    phone: row.phone ?? null,
    photo_url: row.photo_url ?? null,
  }));
}

async function fetchCrmUserProfile(user: CrmUser): Promise<CrmUserProfile | null> {
  const { data, error } = await supabase
    .from('crm_users')
    .select('id, name, email, role, phone, photo_url')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) {
    const { data: byEmail } = user.email
      ? await supabase
        .from('crm_users')
        .select('id, name, email, role, phone, photo_url')
        .eq('email', user.email)
        .maybeSingle()
      : { data: null };
    if (!byEmail) return null;
    return {
      id: byEmail.id,
      name: byEmail.name ?? getUserDisplayName(user),
      email: byEmail.email ?? user.email,
      role: byEmail.role ?? user.role,
      phone: byEmail.phone ?? null,
      photo_url: byEmail.photo_url ?? null,
    };
  }
  return {
    id: data.id,
    name: data.name ?? getUserDisplayName(user),
    email: data.email ?? user.email,
    role: data.role ?? user.role,
    phone: data.phone ?? null,
    photo_url: data.photo_url ?? null,
  };
}

function computeCallStats(logs: CallLogRow[]): Pick<AgentMtdStats, 'connected' | 'talkTimeSeconds' | 'prospects'> {
  let connected = 0;
  let talkTimeSeconds = 0;
  let prospects = 0;
  for (const log of logs) {
    if (isConnectedCallResult(log.call_result)) connected += 1;
    talkTimeSeconds += log.duration_seconds ?? 0;
    if (isProspectCallLog(log)) prospects += 1;
  }
  return {
    connected: Math.round(connected),
    talkTimeSeconds: Math.round(talkTimeSeconds),
    prospects: Math.round(prospects),
  };
}

function countMtdLeadsForAgent(
  leads: { created_at?: string | null; assigned_agent_id?: string | null; agent_id?: string | null }[],
  crmUserId: string,
  employeeId: string | null,
  startIso: string,
): number {
  return leads.filter(lead => {
    if (!lead.created_at || lead.created_at < startIso) return false;
    if (lead.assigned_agent_id && (lead.assigned_agent_id === crmUserId || (employeeId && lead.assigned_agent_id === employeeId))) {
      return true;
    }
    if (lead.agent_id && lead.agent_id === crmUserId) return true;
    return isLeadAssignedToUser(lead, crmUserId, employeeId);
  }).length;
}

function computePipelineCounts(
  leads: { lead_status?: string | null; status?: string | null }[],
): PipelineCounts {
  let newL = 0;
  let hot = 0;
  let warm = 0;
  let won = 0;
  for (const lead of leads) {
    const label = lead.lead_status ?? lead.status ?? '';
    if (label === 'New') newL += 1;
    else if (label === 'Hot') hot += 1;
    else if (label === 'Warm') warm += 1;
    else if (label === 'Won' || label === 'Booked' || label === 'Invoiced') won += 1;
  }
  return {
    newL: Math.round(newL),
    hot: Math.round(hot),
    warm: Math.round(warm),
    won: Math.round(won),
  };
}

export async function fetchHomeDashboardData(user: CrmUser | null): Promise<HomeDashboardData> {
  const emptyStats: AgentMtdStats = {
    connected: 0,
    talkTimeSeconds: 0,
    prospects: 0,
    totalLeads: 0,
    meetings: 0,
    closings: 0,
  };

  const { startIso, startDate } = getMtdBounds();
  const activeUsers = await fetchActiveCrmUsers();

  if (!user) {
    return {
      profile: null,
      agentStats: emptyStats,
      pipeline: { newL: 0, hot: 0, warm: 0, won: 0 },
      champions: { revenue: null, talkTime: null, meetings: null },
    };
  }

  const profile = await fetchCrmUserProfile(user);
  const employeeId = await resolveUserEmployeeId(user);
  const agentIds = uniqueAgentIds(user.id, employeeId);

  const [
    callLogsRes,
    leadsRes,
    meetingsRes,
    dealsRes,
    mtdDealsRes,
    mtdMeetingsRes,
    mtdCallLogsRes,
  ] = await Promise.all([
    agentIds.length
      ? supabase
        .from('call_logs')
        .select('call_result, interest_level, duration_seconds, call_start_time, agent_id')
        .in('agent_id', agentIds)
        .gte('call_start_time', startIso)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('leads')
      .select('id, lead_status, status, created_at, assigned_agent_id, agent_id')
      .gte('created_at', startIso),
    agentIds.length
      ? supabase
        .from('meetings')
        .select('id, agent_id, meeting_date')
        .in('agent_id', agentIds)
        .gte('meeting_date', startDate)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('deals')
      .select('id, agent_id, deal_date')
      .eq('agent_id', user.id)
      .gte('deal_date', startDate),
    supabase
      .from('deals')
      .select('agent_id, sales_value, deal_date')
      .gte('deal_date', startDate),
    supabase
      .from('meetings')
      .select('agent_id, meeting_date')
      .gte('meeting_date', startDate),
    supabase
      .from('call_logs')
      .select('agent_id, duration_seconds, call_start_time')
      .gte('call_start_time', startIso),
  ]);

  const agentCallLogs = (callLogsRes.data ?? []) as CallLogRow[];
  const callStats = computeCallStats(agentCallLogs);

  const mtdLeads = countMtdLeadsForAgent(
    leadsRes.data ?? [],
    user.id,
    employeeId,
    startIso,
  );

  const pipelineLeadsRes = await supabase
    .from('leads')
    .select('lead_status, status, assigned_agent_id, agent_id');
  const scopedPipelineLeads = (pipelineLeadsRes.data ?? []).filter(lead =>
    isLeadAssignedToUser(lead, user.id, employeeId),
  );

  const revenueTotals = new Map<string, number>();
  for (const deal of mtdDealsRes.data ?? []) {
    if (!deal.agent_id) continue;
    const key = String(deal.agent_id);
    revenueTotals.set(key, (revenueTotals.get(key) ?? 0) + (Number(deal.sales_value) || 0));
  }

  const talkTotals = new Map<string, number>();
  for (const log of mtdCallLogsRes.data ?? []) {
    if (!log.agent_id) continue;
    talkTotals.set(log.agent_id, (talkTotals.get(log.agent_id) ?? 0) + (log.duration_seconds ?? 0));
  }

  const meetingTotals = new Map<string, number>();
  for (const meeting of mtdMeetingsRes.data ?? []) {
    if (!meeting.agent_id) continue;
    meetingTotals.set(meeting.agent_id, (meetingTotals.get(meeting.agent_id) ?? 0) + 1);
  }

  return {
    profile,
    agentStats: {
      ...callStats,
      totalLeads: Math.round(mtdLeads),
      meetings: Math.round((meetingsRes.data ?? []).length),
      closings: Math.round((dealsRes.data ?? []).length),
    },
    pipeline: computePipelineCounts(scopedPipelineLeads),
    champions: {
      revenue: pickChampion(revenueTotals, activeUsers, formatAed),
      talkTime: pickChampion(talkTotals, activeUsers, formatTalkTimeHms),
      meetings: pickChampion(meetingTotals, activeUsers, v => String(Math.round(v))),
    },
  };
}

export async function fetchAgentMtdStatsForProfile(user: CrmUser): Promise<{
  profile: CrmUserProfile | null;
  stats: AgentMtdStats;
}> {
  const data = await fetchHomeDashboardData(user);
  return { profile: data.profile, stats: data.agentStats };
}

/** Documented mappings from live call_logs values (see lib/callLog.ts). */
export const CONNECTED_CALL_RESULT_VALUES = [
  'Connected - Interested',
  'Connected - Not Interested',
  'Connected - Follow Up',
  'Connected - Already Bought',
  'Connected - Wrong Number',
];

export const PROSPECT_CALL_RESULT_VALUES = [
  'Connected - Interested',
  'Prospects',
  'Convert to Lead',
];

export const PROSPECT_INTEREST_LEVEL_VALUES = ['Hot', 'Warm'];
