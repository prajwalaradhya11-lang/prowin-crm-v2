import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import { SafeScreenHeader } from '../../components/SafeScreenHeader';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';
import { THEME } from '../../lib/prowinTheme';

const RECRUITMENT_SELECT_COLUMNS =
  'id,candidate_name,source,position_applied,phone,email,interview_status,offer_status,joining_status,notes,cv_url,assigned_recruiter_id,assigned_recruiter_name,call_status,follow_up_date,created_at';

const CALL_STATUSES = [
  'New',
  'Contacted',
  'Interview',
  'Shortlisted',
  'Hired',
  'Rejected',
] as const;

const RECRUITMENT_CALL_RESULTS = [
  'Connected',
  'No Answer',
  'Not Reachable',
  'Interested',
  'Not Interested',
  'Callback',
] as const;

type RecruitmentCandidate = {
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
  call_status: string | null;
  follow_up_date: string | null;
  created_at: string;
};

type RecruitmentCallLog = {
  id: string;
  recruitment_id: string;
  recruiter_id: string | null;
  recruiter_name: string | null;
  call_result: string | null;
  duration_seconds: number | null;
  notes: string | null;
  call_start_time: string | null;
};

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function formatCallDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatCallTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimerDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'New':
      return { bg: '#e0f2fe', border: '#7dd3fc', text: '#0284c7' };
    case 'Contacted':
      return { bg: '#e0e7ff', border: '#a5b4fc', text: '#4f46e5' };
    case 'Interview':
      return { bg: '#ede9fe', border: '#c4b5fd', text: '#7c3aed' };
    case 'Shortlisted':
      return { bg: THEME.amberFill, border: '#f5d9a8', text: THEME.amber };
    case 'Hired':
      return { bg: THEME.greenFill, border: THEME.greenBorder, text: THEME.green };
    case 'Rejected':
      return { bg: '#fee2e2', border: '#fecaca', text: COLORS.red };
    default:
      return { bg: '#f3f3f3', border: THEME.border, text: THEME.meta };
  }
}

function InfoField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null | undefined;
  onPress?: () => void;
}) {
  const display = value?.trim() ? value : '—';
  const content = (
    <Text style={[s.infoValue, onPress && value?.trim() ? s.infoValueLink : null]}>{display}</Text>
  );

  return (
    <View style={s.infoField}>
      <Text style={s.infoLabel}>{label}</Text>
      {onPress && value?.trim() ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
    </View>
  );
}

export default function RecruitmentCandidateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useCrmSession();

  const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null);
  const [callLogs, setCallLogs] = useState<RecruitmentCallLog[]>([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [callActive, setCallActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [callSheetVisible, setCallSheetVisible] = useState(false);
  const [callResult, setCallResult] = useState<string>(RECRUITMENT_CALL_RESULTS[0]);
  const [callNotesDraft, setCallNotesDraft] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  const callStartedAtRef = useRef<Date | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCallTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const resetCallState = useCallback(() => {
    clearCallTimer();
    callStartedAtRef.current = null;
    setCallActive(false);
    setElapsedSeconds(0);
  }, [clearCallTimer]);

  const fetchCallLogs = useCallback(async (recruitmentId: string) => {
    const { data, error } = await supabase
      .from('recruitment_call_logs')
      .select('*')
      .eq('recruitment_id', recruitmentId)
      .order('call_start_time', { ascending: false });

    if (error) {
      console.log('[recruitment] call logs fetch error', error.message);
      return;
    }

    setCallLogs((data ?? []) as RecruitmentCallLog[]);
  }, []);

  const loadCandidate = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('recruitment')
      .select(RECRUITMENT_SELECT_COLUMNS)
      .eq('id', id)
      .single();

    if (error || !data) {
      setCandidate(null);
      setCallLogs([]);
      setLoading(false);
      if (error) {
        Alert.alert('Error', error.message);
      }
      return;
    }

    const row = data as RecruitmentCandidate;
    setCandidate(row);
    setNotesDraft(row.notes ?? '');
    await fetchCallLogs(row.id);
    setLoading(false);
  }, [id, fetchCallLogs]);

  useEffect(() => {
    void loadCandidate();
  }, [loadCandidate]);

  useEffect(() => {
    return () => {
      clearCallTimer();
      callStartedAtRef.current = null;
    };
  }, [clearCallTimer]);

  const handleStatusChange = useCallback(async (nextStatus: string) => {
    if (!id || !candidate || updatingStatus) return;

    setUpdatingStatus(true);
    const { error } = await supabase
      .from('recruitment')
      .update({ call_status: nextStatus })
      .eq('id', id);

    setUpdatingStatus(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setCandidate((prev) => (prev ? { ...prev, call_status: nextStatus } : prev));
  }, [id, candidate, updatingStatus]);

  const handleSaveNotes = useCallback(async () => {
    if (!id || savingNotes) return;

    setSavingNotes(true);
    const { error } = await supabase
      .from('recruitment')
      .update({ notes: trimOrNull(notesDraft) })
      .eq('id', id);

    setSavingNotes(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setCandidate((prev) => (prev ? { ...prev, notes: trimOrNull(notesDraft) } : prev));
    Alert.alert('Success', 'Notes saved.');
  }, [id, notesDraft, savingNotes]);

  const handleStartCall = useCallback(() => {
    if (callActive) return;

    clearCallTimer();
    const startedAt = new Date();
    callStartedAtRef.current = startedAt;
    setCallActive(true);
    setElapsedSeconds(0);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)));
    }, 1000);

    if (candidate?.phone?.trim()) {
      Linking.openURL(`tel:${candidate.phone.trim()}`);
    }
  }, [callActive, candidate?.phone, clearCallTimer]);

  const handleEndCallPress = useCallback(() => {
    if (!callActive || !callStartedAtRef.current) return;

    clearCallTimer();
    setCallResult(RECRUITMENT_CALL_RESULTS[0]);
    setCallNotesDraft('');
    setCallSheetVisible(true);
  }, [callActive, clearCallTimer]);

  const closeCallSheet = useCallback(() => {
    setCallSheetVisible(false);
    resetCallState();
  }, [resetCallState]);

  const confirmCallLog = useCallback(async () => {
    if (!id || !user?.id || savingCall) return;

    const startedAt = callStartedAtRef.current;
    if (!startedAt) {
      Alert.alert('Error', 'No active call to log.');
      return;
    }

    setSavingCall(true);

    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
    const currentStatus = candidate?.call_status?.trim() || 'New';

    const { error: insertError } = await supabase.from('recruitment_call_logs').insert({
      recruitment_id: id,
      recruiter_id: user.id,
      recruiter_name: getUserDisplayName(user),
      call_result: callResult,
      duration_seconds: durationSeconds,
      notes: trimOrNull(callNotesDraft),
      call_start_time: startedAt.toISOString(),
    });

    if (insertError) {
      setSavingCall(false);
      Alert.alert('Error', insertError.message);
      return;
    }

    if (currentStatus === 'New') {
      const { error: updateError } = await supabase
        .from('recruitment')
        .update({ call_status: 'Contacted' })
        .eq('id', id);

      if (updateError) {
        setSavingCall(false);
        Alert.alert('Error', `Call logged but status update failed: ${updateError.message}`);
        setCallSheetVisible(false);
        resetCallState();
        await fetchCallLogs(id);
        return;
      }

      setCandidate((prev) => (prev ? { ...prev, call_status: 'Contacted' } : prev));
    }

    setSavingCall(false);
    setCallSheetVisible(false);
    resetCallState();
    await fetchCallLogs(id);
    Alert.alert('Success', 'Call logged.');
  }, [
    id,
    user,
    savingCall,
    candidate?.call_status,
    callResult,
    callNotesDraft,
    resetCallState,
    fetchCallLogs,
  ]);

  const modalMaxHeight = Dimensions.get('window').height * 0.55;
  const currentStatus = candidate?.call_status?.trim() || 'New';

  if (loading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  if (!candidate || !id) {
    return (
      <View style={[s.container, s.centered]}>
        <Text style={s.emptyText}>Candidate not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeScreenHeader title={candidate.candidate_name} onBack={() => router.back()} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.section}>
          <Text style={s.sectionTitle}>CANDIDATE INFO</Text>
          <View style={s.card}>
            <Text style={s.candidateName}>{candidate.candidate_name}</Text>
            <InfoField label="POSITION" value={candidate.position_applied} />
            <InfoField label="SOURCE" value={candidate.source} />
            <InfoField
              label="PHONE"
              value={candidate.phone}
              onPress={() => {
                if (candidate.phone?.trim()) {
                  Linking.openURL(`tel:${candidate.phone.trim()}`);
                }
              }}
            />
            <InfoField label="EMAIL" value={candidate.email} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>CALL STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusRow}>
            {CALL_STATUSES.map((status) => {
              const style = getStatusStyle(status);
              const selected = currentStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    s.statusChip,
                    {
                      backgroundColor: selected ? style.bg : COLORS.white,
                      borderColor: selected ? style.text : COLORS.border,
                    },
                  ]}
                  onPress={() => void handleStatusChange(status)}
                  disabled={updatingStatus}
                >
                  <Text style={[s.statusChipText, { color: selected ? style.text : COLORS.muted }]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>NOTES</Text>
          <TextInput
            style={s.notesInput}
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Add notes about this candidate"
            placeholderTextColor={COLORS.muted}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[s.saveNotesBtn, savingNotes && s.btnDisabled]}
            onPress={() => void handleSaveNotes()}
            disabled={savingNotes}
          >
            {savingNotes ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.saveNotesBtnText}>Save notes</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>CALL</Text>
          <View style={s.callCard}>
            {callActive ? (
              <Text style={s.timerText}>{formatTimerDisplay(elapsedSeconds)}</Text>
            ) : (
              <Text style={s.callHint}>Start a timed call to log duration and result.</Text>
            )}
            <TouchableOpacity
              style={[s.callBtn, callActive && s.endCallBtn]}
              onPress={callActive ? handleEndCallPress : handleStartCall}
            >
              <Ionicons name={callActive ? 'stop-circle-outline' : 'call-outline'} size={18} color="#fff" />
              <Text style={s.callBtnText}>{callActive ? 'End Call' : 'Call'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>CALL HISTORY</Text>
          {callLogs.length === 0 ? (
            <Text style={s.emptyHistory}>No calls logged yet.</Text>
          ) : (
            callLogs.map((log) => (
              <View key={log.id} style={s.logRow}>
                <View style={s.logTop}>
                  <Text style={s.logResult}>{log.call_result ?? '—'}</Text>
                  <Text style={s.logDuration}>{formatCallDuration(log.duration_seconds)}</Text>
                </View>
                <Text style={s.logTime}>{formatCallTime(log.call_start_time)}</Text>
                {log.notes?.trim() ? <Text style={s.logNotes}>{log.notes}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={callSheetVisible} animationType="slide" transparent onRequestClose={closeCallSheet}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalSheet, { maxHeight: modalMaxHeight }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Log call</Text>
              <TouchableOpacity onPress={closeCallSheet} disabled={savingCall}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.modalBody}
              contentContainerStyle={s.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.fieldLabel}>CALL RESULT</Text>
              <View style={s.resultGrid}>
                {RECRUITMENT_CALL_RESULTS.map((result) => {
                  const selected = callResult === result;
                  return (
                    <TouchableOpacity
                      key={result}
                      style={[s.resultChip, selected && s.resultChipOn]}
                      onPress={() => setCallResult(result)}
                      disabled={savingCall}
                    >
                      <Text style={[s.resultChipText, selected && s.resultChipTextOn]}>{result}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={s.modalNotesInput}
                value={callNotesDraft}
                onChangeText={setCallNotesDraft}
                placeholder="Call notes"
                placeholderTextColor={COLORS.muted}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeCallSheet} disabled={savingCall}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, savingCall && s.btnDisabled]}
                onPress={() => void confirmCallLog()}
                disabled={savingCall}
              >
                {savingCall ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 32 },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    gap: 10,
  },
  candidateName: { fontSize: 18, fontWeight: '800', color: THEME.heading, marginBottom: 4 },
  infoField: { gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: THEME.heading },
  infoValueLink: { color: COLORS.red },
  statusRow: { gap: 8, paddingVertical: 2 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 12, fontWeight: '700' },
  notesInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 110,
    fontSize: 14,
    color: COLORS.text,
  },
  saveNotesBtn: {
    marginTop: 10,
    backgroundColor: COLORS.red,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveNotesBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  callCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '800',
    color: THEME.heading,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  callHint: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.green,
    borderRadius: 10,
    paddingVertical: 13,
  },
  endCallBtn: { backgroundColor: COLORS.red },
  callBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyHistory: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic' },
  logRow: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  logResult: { fontSize: 14, fontWeight: '800', color: THEME.heading, flex: 1 },
  logDuration: { fontSize: 12, fontWeight: '700', color: THEME.blue },
  logTime: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  logNotes: { fontSize: 13, color: THEME.heading, marginTop: 6, lineHeight: 18 },
  emptyText: { fontSize: 16, color: COLORS.muted, marginBottom: 12 },
  backLink: { fontSize: 14, fontWeight: '700', color: COLORS.red },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalBody: { flexGrow: 0 },
  modalBodyContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  resultChipOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  resultChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  resultChipTextOn: { color: '#fff' },
  modalNotesInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 80,
    fontSize: 14,
    color: COLORS.text,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.red,
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
});
