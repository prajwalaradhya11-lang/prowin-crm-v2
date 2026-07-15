import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Linking, Alert,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { AddNoteModal } from '../../components/AddNoteModal';
import { LeadDetailShell } from '../../components/leads/LeadDetailShell';
import { LeadInfoTab } from '../../components/leads/LeadInfoTab';
import { LeadEnquiryTab } from '../../components/leads/LeadEnquiryTab';
import { LeadHistoryTab } from '../../components/leads/LeadHistoryTab';
import { LeadNotesTab } from '../../components/leads/LeadNotesTab';
import { LeadDocsTab } from '../../components/leads/LeadDocsTab';
import { AgentPickerSheet } from '../../components/leads/AgentPickerSheet';
import { LogCallSheet, type LogCallSheetMode } from '../../components/leads/LogCallSheet';
import type { LeadDetailTabId } from '../../components/leads/LeadDetailTabBar';
import { getName } from '../../lib/leadName';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';
import { useLeadCallTimer } from '../../hooks/useLeadCallTimer';
import { addLeadNote, updateLeadInterest } from '../../lib/leadStatus';
import { resolveEmployeeIdForUser } from '../../lib/callLog';
import { fetchLeadActivitiesForLead } from '../../lib/leadActivities';
import { resolveAssignedAgentName, canSeeAllLeads } from '../../lib/rbac';
import { getLastNoteFromActivities } from '../../lib/leadDisplay';
import { getLeadInterest } from '../../lib/leadFields';
import {
  loadAgentOptions,
  requestLeadReassign,
  updateSecondaryAgent,
  type AgentOption,
} from '../../lib/leadAgents';
import {
  fetchCallLogsForLead,
  computeHistoryStats,
  buildHistoryEvents,
} from '../../lib/leadHistory';
import { extractNotesFromActivities } from '../../lib/leadNotes';
import {
  fetchLeadDocuments,
  uploadLeadDocument,
  deleteLeadDocument,
  pickDocumentFile,
  pickImageFile,
  type LeadDocument,
} from '../../lib/leadDocuments';
import { THEME } from '../../lib/prowinTheme';
import { Ionicons } from '@expo/vector-icons';

type AgentPickerMode = 'secondary' | 'reassign' | null;

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, role } = useCrmSession();
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [assignedToName, setAssignedToName] = useState('Unassigned');
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [noteModal, setNoteModal] = useState(false);
  const [sheetMode, setSheetMode] = useState<LogCallSheetMode | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callDurationSource, setCallDurationSource] = useState<'call_log' | 'timer' | 'manual'>('manual');

  const openSheet = useCallback((mode: LogCallSheetMode, duration = 0, source: 'call_log' | 'timer' | 'manual' = 'manual') => {
    setCallDuration(duration);
    setCallDurationSource(source);
    setSheetMode(mode);
  }, []);

  const onCallEnded = useCallback((result: { durationSeconds: number; source: 'call_log' | 'timer' }) => {
    openSheet('log-call', result.durationSeconds, result.source);
  }, [openSheet]);

  const { startLeadCall } = useLeadCallTimer(onCallEnded);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('Unknown');
  const [infoNoteDraft, setInfoNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingInterest, setSavingInterest] = useState(false);
  const [agentPickerMode, setAgentPickerMode] = useState<AgentPickerMode>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  const lookupAgentName = useCallback(async (agentId: string): Promise<string | null> => {
    const { data: crmUser } = await supabase
      .from('crm_users')
      .select('name')
      .eq('id', agentId)
      .maybeSingle();
    if (crmUser?.name) return crmUser.name;

    const { data: employee } = await supabase
      .from('employees')
      .select('full_name')
      .eq('id', agentId)
      .maybeSingle();
    return employee?.full_name ?? null;
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: leadData } = await supabase.from('leads').select('*').eq('id', id).single();

    if (leadData) {
      setLead(leadData);
      setAssignedToName(await resolveAssignedAgentName(leadData, lookupAgentName));
      const [acts, logs] = await Promise.all([
        fetchLeadActivitiesForLead(id, user, role, leadData),
        fetchCallLogsForLead(id),
      ]);
      setActivities(acts);
      setCallLogs(logs);
    } else {
      setLead(null);
      setActivities([]);
      setCallLogs([]);
    }

    setLoading(false);
  }, [id, user, role, lookupAgentName]);

  const loadDocuments = useCallback(async () => {
    if (!id) return;
    setDocsLoading(true);
    const docs = await fetchLeadDocuments(id);
    setDocuments(docs);
    setDocsLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    if (!user) return;
    void resolveEmployeeIdForUser(user.email, getUserDisplayName(user)).then(emp => {
      if (emp) {
        setAgentId(emp.id);
        setAgentName(emp.fullName);
      }
    });
  }, [user]);

  function getLeadStatus() {
    return lead?.lead_status ?? lead?.status ?? 'Prospects';
  }

  const lastNote = useMemo(() => getLastNoteFromActivities(activities), [activities]);
  const notes = useMemo(() => extractNotesFromActivities(activities), [activities]);
  const historyEvents = useMemo(
    () => buildHistoryEvents(activities, callLogs),
    [activities, callLogs],
  );
  const historyStats = useMemo(() => computeHistoryStats(callLogs), [callLogs]);

  const doneBy = user ? getUserDisplayName(user) : 'Unknown';

  async function handleSaveNote(note: string) {
    await addLeadNote(lead.id, note, doneBy);
    setNoteModal(false);
    setInfoNoteDraft('');
    loadData();
  }

  async function handleSaveInfoNote() {
    if (!infoNoteDraft.trim()) return;
    setSavingNote(true);
    try {
      await addLeadNote(lead.id, infoNoteDraft, doneBy);
      setInfoNoteDraft('');
      await loadData();
    } finally {
      setSavingNote(false);
    }
  }

  async function handleInterestChange(newInterest: string) {
    const oldInterest = getLeadInterest(lead);
    if (oldInterest === newInterest) return;
    setSavingInterest(true);
    try {
      await updateLeadInterest(lead.id, oldInterest, newInterest, doneBy);
      await loadData();
    } finally {
      setSavingInterest(false);
    }
  }

  async function openAgentPicker(mode: AgentPickerMode) {
    setAgentPickerMode(mode);
    setAgentsLoading(true);
    try {
      setAgents(await loadAgentOptions());
    } finally {
      setAgentsLoading(false);
    }
  }

  async function handleAgentSelected(agent: AgentOption) {
    const mode = agentPickerMode;
    setAgentPickerMode(null);
    if (!mode) return;
    try {
      if (mode === 'secondary') {
        await updateSecondaryAgent(lead.id, agent.id, agent.fullName, doneBy);
        Alert.alert('Secondary agent added', agent.fullName);
      } else {
        await requestLeadReassign(lead.id, agent.id, agent.fullName, doneBy);
        Alert.alert('Re-assign requested', `Pending approval for ${agent.fullName}`);
      }
      await loadData();
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'Check that migration columns exist on leads.');
    }
  }

  async function handleDocUpload(displayName: string, source: 'document' | 'image') {
    setUploadingDoc(true);
    try {
      const picked = source === 'document'
        ? await pickDocumentFile()
        : await pickImageFile();
      if (!picked) return;
      await uploadLeadDocument(lead.id, picked, displayName, doneBy);
      await loadDocuments();
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDocDelete(doc: LeadDocument) {
    await deleteLeadDocument(doc);
    await loadDocuments();
  }

  function handleSms() {
    if (!lead?.phone) return;
    Linking.openURL(`sms:${lead.phone}`);
  }

  function handleEdit() {
    Alert.alert('Edit lead', undefined, [
      { text: 'Add note', onPress: () => setNoteModal(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleCall() {
    startLeadCall(lead?.phone);
  }

  function renderTab(tabId: LeadDetailTabId) {
    if (!lead) return null;
    switch (tabId) {
      case 'info':
        return (
          <>
            <LeadInfoTab
              statusLabel={getLeadStatus()}
              assignedToName={assignedToName}
              secondaryAgentName={lead.secondary_agent_name}
              reassignPendingName={lead.reassign_pending_to_name}
              lead={lead}
              lastNote={lastNote}
              noteDraft={infoNoteDraft}
              savingNote={savingNote}
              savingInterest={savingInterest}
              onChangeStatus={() => openSheet('change-status')}
              onScheduleFollowUp={() => openSheet('change-status')}
              onNoteDraftChange={setInfoNoteDraft}
              onSaveNote={handleSaveInfoNote}
              onInterestChange={handleInterestChange}
              onAddSecondaryAgent={() => openAgentPicker('secondary')}
              onReassignLead={() => openAgentPicker('reassign')}
            />
            {canSeeAllLeads(role) && lead.is_archived && (
              <View style={s.archivedBanner}>
                <Ionicons name="archive-outline" size={14} color={THEME.amber} />
                <Text style={s.archivedText}>This lead is archived</Text>
              </View>
            )}
          </>
        );
      case 'enquiry':
        return <LeadEnquiryTab lead={lead} />;
      case 'history':
        return <LeadHistoryTab stats={historyStats} events={historyEvents} />;
      case 'notes':
        return <LeadNotesTab notes={notes} onAddNote={() => setNoteModal(true)} />;
      case 'docs':
        return (
          <LeadDocsTab
            documents={documents}
            loading={docsLoading}
            uploading={uploadingDoc}
            onUpload={handleDocUpload}
            onDelete={handleDocDelete}
          />
        );
      default:
        return null;
    }
  }

  if (loading && !lead) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={THEME.red} size="large" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>Lead not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LeadDetailShell
        lead={lead}
        activeTabIndex={activeTabIndex}
        onTabIndexChange={setActiveTabIndex}
        onBack={() => router.back()}
        onEdit={handleEdit}
        onCall={handleCall}
        onWhatsApp={() => Linking.openURL(`https://wa.me/${lead.phone?.replace(/\D/g, '')}`)}
        onSms={handleSms}
        onLog={() => openSheet('log-call', callDuration, 'manual')}
        renderTab={renderTab}
      />

      <AgentPickerSheet
        visible={agentPickerMode !== null}
        title={agentPickerMode === 'reassign' ? 'Re-assign to agent' : 'Add secondary agent'}
        agents={agents}
        loading={agentsLoading}
        onClose={() => setAgentPickerMode(null)}
        onSelect={handleAgentSelected}
      />

      <AddNoteModal
        visible={noteModal}
        onClose={() => setNoteModal(false)}
        onSave={handleSaveNote}
      />

      <LogCallSheet
        visible={sheetMode !== null}
        mode={sheetMode ?? 'change-status'}
        lead={lead}
        durationSeconds={callDuration}
        durationSource={callDurationSource}
        doneBy={doneBy}
        agentId={agentId}
        agentName={agentName}
        onClose={() => setSheetMode(null)}
        onSaved={loadData}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.page, gap: 12 },
  emptyText: { fontSize: 15, color: THEME.meta },
  backLink: { fontSize: 14, color: THEME.red, fontWeight: '700' },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.amberFill,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 14,
    marginTop: 4,
  },
  archivedText: { fontSize: 12, fontWeight: '700', color: THEME.amber },
});
