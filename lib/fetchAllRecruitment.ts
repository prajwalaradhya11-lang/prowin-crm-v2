import { supabase } from './supabase';
import type { CrmUser } from '../hooks/useCrmSession';

const PAGE_SIZE = 1000;

export const RECRUITMENT_EXPORT_SELECT =
  'id,candidate_name,source,position_applied,phone,email,interview_status,offer_status,joining_status,notes,cv_url,assigned_recruiter_id,assigned_recruiter_name,added_by_id,added_by_name,call_status,follow_up_date,created_at';

export type RecruitmentExportRow = {
  id: string;
  candidate_name: string;
  source: string | null;
  position_applied: string | null;
  phone: string | null;
  email: string | null;
  interview_status: string | null;
  offer_status: string | null;
  joining_status: string | null;
  notes: string | null;
  cv_url: string | null;
  assigned_recruiter_id: string | null;
  assigned_recruiter_name: string | null;
  added_by_id: string | null;
  added_by_name: string | null;
  call_status: string | null;
  follow_up_date: string | null;
  created_at: string;
};

function isRecruiterRole(role: string | null | undefined): boolean {
  return role === 'recruiter';
}

function canViewAllCandidates(role: string | null | undefined): boolean {
  return role === 'hr_manager' || role === 'admin' || role === 'super_admin';
}

/**
 * Paginated fetch of active recruitment candidates, respecting list scoping:
 * - recruiter → only assigned_recruiter_id = user.id
 * - hr_manager / admin / super_admin → all non-deleted
 * Always: deleted_at IS NULL
 */
export async function fetchAllRecruitment(
  user: CrmUser | null,
  role: string | null,
): Promise<{ data: RecruitmentExportRow[]; error: Error | null }> {
  const all: RecruitmentExportRow[] = [];
  let from = 0;

  try {
    if (!canViewAllCandidates(role) && !isRecruiterRole(role)) {
      return { data: [], error: null };
    }
    if (isRecruiterRole(role) && !user?.id) {
      return { data: [], error: null };
    }

    while (true) {
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('recruitment')
        .select(RECRUITMENT_EXPORT_SELECT)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (isRecruiterRole(role) && user?.id) {
        query = query.eq('assigned_recruiter_id', user.id);
      }

      const { data, error } = await query;
      if (error) {
        return { data: [], error: new Error(error.message) };
      }

      const batch = (data ?? []) as RecruitmentExportRow[];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return { data: all, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e : new Error('Failed to fetch recruitment candidates for export.'),
    };
  }
}
