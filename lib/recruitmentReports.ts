import { format, startOfMonth, startOfWeek } from 'date-fns';
import { supabase } from './supabase';
import type { CrmUser } from '../hooks/useCrmSession';

export type RecruitmentReportPeriod = 'This Week' | 'This Month' | 'All Time';

export type RecruitmentReportResult = {
  callsInPeriod: number;
  callsByResult: { result: string; count: number }[];
  talkTimeSeconds: number;
  candidatesAddedInPeriod: number;
  pipelineByStatus: { status: string; count: number }[];
  upcomingInterviews: { candidate_name: string; interview_date: string }[];
  atInterviewCount: number;
  employees: { total: number; active: number; terminated: number } | null;
};

const PIPELINE_STATUSES = [
  'New',
  'Contacted',
  'Interview',
  'Shortlisted',
  'Hired',
  'Rejected',
] as const;

const EMPTY_PIPELINE: { status: string; count: number }[] = PIPELINE_STATUSES.map((status) => ({
  status,
  count: 0,
}));

export const EMPTY_RECRUITMENT_REPORT: RecruitmentReportResult = {
  callsInPeriod: 0,
  callsByResult: [],
  talkTimeSeconds: 0,
  candidatesAddedInPeriod: 0,
  pipelineByStatus: EMPTY_PIPELINE,
  upcomingInterviews: [],
  atInterviewCount: 0,
  employees: null,
};

function isRecruiterRole(role: string | null | undefined): boolean {
  return role === 'recruiter';
}

function canViewAllRecruitment(role: string | null | undefined): boolean {
  return role === 'hr_manager' || role === 'admin' || role === 'super_admin';
}

function normalizeCallStatus(status: string | null | undefined): string {
  const trimmed = status?.trim();
  if (!trimmed) return 'New';
  const match = PIPELINE_STATUSES.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

function periodStartIso(period: RecruitmentReportPeriod): string | null {
  const now = new Date();
  if (period === 'This Week') return startOfWeek(now).toISOString();
  if (period === 'This Month') return startOfMonth(now).toISOString();
  return null;
}

function todayDateOnly(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatTalkTimeShort(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export async function fetchRecruitmentReport(
  user: CrmUser | null,
  role: string | null,
  period: RecruitmentReportPeriod,
): Promise<RecruitmentReportResult> {
  try {
    if (!canViewAllRecruitment(role) && !isRecruiterRole(role)) {
      return EMPTY_RECRUITMENT_REPORT;
    }
    if (isRecruiterRole(role) && !user?.id) {
      return EMPTY_RECRUITMENT_REPORT;
    }

    const fromIso = periodStartIso(period);
    const today = todayDateOnly();
    const isRecruiter = isRecruiterRole(role);
    const canViewAll = canViewAllRecruitment(role);

    let candidatesQuery = supabase
      .from('recruitment')
      .select('id, candidate_name, call_status, interview_date, assigned_recruiter_id, created_at');

    if (isRecruiter && user?.id) {
      candidatesQuery = candidatesQuery.eq('assigned_recruiter_id', user.id);
    }

    let callLogsQuery = supabase
      .from('recruitment_call_logs')
      .select('id, recruiter_id, call_result, duration_seconds, call_start_time');

    if (fromIso) {
      callLogsQuery = callLogsQuery.gte('call_start_time', fromIso);
    }
    if (isRecruiter && user?.id) {
      callLogsQuery = callLogsQuery.eq('recruiter_id', user.id);
    }

    const employeesPromise = canViewAll
      ? supabase.from('employees').select('id, status')
      : Promise.resolve({ data: null, error: null });

    const [candidatesRes, callLogsRes, employeesRes] = await Promise.all([
      candidatesQuery,
      callLogsQuery,
      employeesPromise,
    ]);

    if (candidatesRes.error) {
      console.warn('[recruitmentReports] candidates', candidatesRes.error.message);
    }
    if (callLogsRes.error) {
      console.warn('[recruitmentReports] call logs', callLogsRes.error.message);
    }
    if (employeesRes.error) {
      console.warn('[recruitmentReports] employees', employeesRes.error.message);
    }

    const candidates = candidatesRes.data ?? [];
    const callLogs = callLogsRes.data ?? [];

    const statusCounts: Record<string, number> = {};
    for (const status of PIPELINE_STATUSES) statusCounts[status] = 0;

    let atInterviewCount = 0;
    let candidatesAddedInPeriod = 0;
    const upcoming: { candidate_name: string; interview_date: string }[] = [];

    for (const row of candidates) {
      const status = normalizeCallStatus(row.call_status);
      if (status in statusCounts) {
        statusCounts[status] += 1;
      } else {
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      }

      if (status.toLowerCase() === 'interview') {
        atInterviewCount += 1;
      }

      if (!fromIso || (row.created_at && row.created_at >= fromIso)) {
        candidatesAddedInPeriod += 1;
      }

      const interviewDate = row.interview_date?.trim();
      if (interviewDate && interviewDate >= today) {
        upcoming.push({
          candidate_name: row.candidate_name?.trim() || 'Candidate',
          interview_date: interviewDate,
        });
      }
    }

    upcoming.sort((a, b) => a.interview_date.localeCompare(b.interview_date));

    const resultMap: Record<string, number> = {};
    let talkTimeSeconds = 0;
    for (const log of callLogs) {
      const result = log.call_result?.trim() || 'Unknown';
      resultMap[result] = (resultMap[result] ?? 0) + 1;
      talkTimeSeconds += Math.max(0, Number(log.duration_seconds) || 0);
    }

    const callsByResult = Object.entries(resultMap)
      .map(([result, count]) => ({ result, count }))
      .sort((a, b) => b.count - a.count);

    const pipelineByStatus = PIPELINE_STATUSES.map((status) => ({
      status,
      count: statusCounts[status] ?? 0,
    }));

    let employees: RecruitmentReportResult['employees'] = null;
    if (canViewAll) {
      const rows = employeesRes.data ?? [];
      let active = 0;
      let terminated = 0;
      for (const row of rows) {
        const status = (row.status ?? '').toLowerCase();
        if (status === 'active') active += 1;
        else if (status === 'terminated') terminated += 1;
      }
      employees = { total: rows.length, active, terminated };
    }

    return {
      callsInPeriod: callLogs.length,
      callsByResult,
      talkTimeSeconds,
      candidatesAddedInPeriod,
      pipelineByStatus,
      upcomingInterviews: upcoming.slice(0, 20),
      atInterviewCount,
      employees,
    };
  } catch (e) {
    console.warn('[recruitmentReports] unexpected error', e);
    return EMPTY_RECRUITMENT_REPORT;
  }
}
