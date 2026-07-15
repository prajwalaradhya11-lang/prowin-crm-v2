import { format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { supabase } from './supabase';
import type { CrmUser } from '../hooks/useCrmSession';

export type RecruitmentReportPeriod = 'Today' | 'This Week' | 'This Month' | 'All Time';

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

export type RecruitmentCallerRow = {
  recruiterId: string;
  recruiterName: string;
  calls: number;
  talkTimeSeconds: number;
  byResult: Record<string, number>;
};

export type RecruitmentCallingReportResult = {
  totalCalls: number;
  talkTimeSeconds: number;
  rows: RecruitmentCallerRow[];
  resultColumns: readonly string[];
};

export const RECRUITMENT_CALL_RESULTS = [
  'Connected',
  'No Answer',
  'Not Reachable',
  'Interested',
  'Not Interested',
  'Callback',
] as const;

export const RECRUITMENT_REPORT_PERIODS: RecruitmentReportPeriod[] = [
  'This Week',
  'This Month',
  'All Time',
];

export const RECRUITMENT_CALLING_REPORT_PERIODS: RecruitmentReportPeriod[] = [
  'Today',
  'This Week',
  'This Month',
  'All Time',
];

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

export const EMPTY_RECRUITMENT_CALLING_REPORT: RecruitmentCallingReportResult = {
  totalCalls: 0,
  talkTimeSeconds: 0,
  rows: [],
  resultColumns: RECRUITMENT_CALL_RESULTS,
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
  if (period === 'All Time') return null;
  if (period === 'Today') return startOfDay(now).toISOString();
  if (period === 'This Week') return startOfWeek(now).toISOString();
  return startOfMonth(now).toISOString();
}

function todayDateOnly(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function emptyResultCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of RECRUITMENT_CALL_RESULTS) counts[result] = 0;
  return counts;
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

export async function fetchRecruitmentCallingReport(
  user: CrmUser | null,
  role: string | null,
  period: RecruitmentReportPeriod,
): Promise<RecruitmentCallingReportResult> {
  try {
    if (!canViewAllRecruitment(role) && !isRecruiterRole(role)) {
      return EMPTY_RECRUITMENT_CALLING_REPORT;
    }
    if (isRecruiterRole(role) && !user?.id) {
      return EMPTY_RECRUITMENT_CALLING_REPORT;
    }

    const fromIso = periodStartIso(period);
    const isRecruiter = isRecruiterRole(role);

    let callLogsQuery = supabase
      .from('recruitment_call_logs')
      .select('id, recruiter_id, recruiter_name, call_result, duration_seconds, call_start_time');

    if (fromIso) {
      callLogsQuery = callLogsQuery.gte('call_start_time', fromIso);
    }
    if (isRecruiter && user?.id) {
      callLogsQuery = callLogsQuery.eq('recruiter_id', user.id);
    }

    const { data, error } = await callLogsQuery;
    if (error) {
      console.warn('[recruitmentReports] calling report', error.message);
      return EMPTY_RECRUITMENT_CALLING_REPORT;
    }

    const callLogs = data ?? [];
    const byRecruiter = new Map<string, RecruitmentCallerRow>();
    let talkTimeSeconds = 0;

    for (const log of callLogs) {
      const duration = Math.max(0, Number(log.duration_seconds) || 0);
      talkTimeSeconds += duration;

      const recruiterId = log.recruiter_id?.trim() || '__unknown__';
      const storedName = log.recruiter_name?.trim();
      let row = byRecruiter.get(recruiterId);
      if (!row) {
        row = {
          recruiterId,
          recruiterName: storedName || 'Unknown recruiter',
          calls: 0,
          talkTimeSeconds: 0,
          byResult: emptyResultCounts(),
        };
        byRecruiter.set(recruiterId, row);
      } else if (storedName) {
        row.recruiterName = storedName;
      }

      row.calls += 1;
      row.talkTimeSeconds += duration;

      const result = log.call_result?.trim() || 'Unknown';
      if (result in row.byResult) {
        row.byResult[result] += 1;
      } else {
        row.byResult[result] = (row.byResult[result] ?? 0) + 1;
      }
    }

    const knownResults = new Set<string>(RECRUITMENT_CALL_RESULTS);
    const extraResults = new Set<string>();
    for (const row of byRecruiter.values()) {
      for (const key of Object.keys(row.byResult)) {
        if (!knownResults.has(key) && row.byResult[key] > 0) extraResults.add(key);
      }
    }
    const resultColumns = [
      ...RECRUITMENT_CALL_RESULTS,
      ...Array.from(extraResults).sort((a, b) => a.localeCompare(b)),
    ];

    const rows = Array.from(byRecruiter.values()).sort((a, b) => {
      if (b.calls !== a.calls) return b.calls - a.calls;
      return a.recruiterName.localeCompare(b.recruiterName);
    });

    return {
      totalCalls: callLogs.length,
      talkTimeSeconds,
      rows,
      resultColumns,
    };
  } catch (e) {
    console.warn('[recruitmentReports] calling report unexpected error', e);
    return EMPTY_RECRUITMENT_CALLING_REPORT;
  }
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
      .select('id, candidate_name, call_status, interview_date, assigned_recruiter_id, created_at')
      .is('deleted_at', null);

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
