import { supabase } from './supabase';
import { fetchAgentOptions, type AgentOption } from './callLog';

export { type AgentOption };

export async function updateSecondaryAgent(
  leadId: string,
  agentId: string,
  agentName: string,
  doneBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({
      secondary_agent_id: agentId,
      secondary_agent_name: agentName,
    })
    .eq('id', leadId);

  if (error) throw error;

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'field_changed',
    note: `Secondary agent added: ${agentName}`,
    done_by: doneBy,
    field_changed: 'Secondary Agent',
    old_value: null,
    new_value: agentName,
    created_at: new Date().toISOString(),
  });
}

/** Stub: stores pending re-assign on the lead row until manager approval flow exists. */
export async function requestLeadReassign(
  leadId: string,
  targetAgentId: string,
  targetAgentName: string,
  doneBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({
      reassign_pending_to_id: targetAgentId,
      reassign_pending_to_name: targetAgentName,
      reassign_pending_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) throw error;

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'assignment_changed',
    note: `Re-assign requested to ${targetAgentName} (pending approval)`,
    done_by: doneBy,
    field_changed: 'Assigned Agent',
    old_value: null,
    new_value: targetAgentName,
    created_at: new Date().toISOString(),
  });
}

export async function loadAgentOptions(): Promise<AgentOption[]> {
  return fetchAgentOptions();
}

export async function resolveAgentName(agentId: string): Promise<string | null> {
  const { data: employee } = await supabase
    .from('employees')
    .select('full_name')
    .eq('id', agentId)
    .maybeSingle();
  return employee?.full_name ?? null;
}
