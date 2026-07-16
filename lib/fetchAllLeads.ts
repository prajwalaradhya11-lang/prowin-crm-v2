import { supabase } from './supabase';
import type { CrmRole, CrmUser } from '../hooks/useCrmSession';
import { filterLeadsForUser, resolveUserEmployeeId } from './rbac';

const PAGE_SIZE = 1000;

/**
 * Paginated fetch of leads, then apply the same RBAC filter as the Leads list.
 * Agents only get their assigned leads; admin/manager/tech get all.
 */
export async function fetchAllLeads(
  user: CrmUser | null,
  role: CrmRole | null,
): Promise<{ data: Record<string, unknown>[]; error: Error | null }> {
  const all: Record<string, unknown>[] = [];
  let from = 0;

  try {
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        return { data: [], error: new Error(error.message) };
      }

      const batch = (data ?? []) as Record<string, unknown>[];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const employeeId = await resolveUserEmployeeId(user);
    const scoped = filterLeadsForUser(all as any[], user, role, employeeId);
    return { data: scoped, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e : new Error('Failed to fetch leads for export.'),
    };
  }
}
