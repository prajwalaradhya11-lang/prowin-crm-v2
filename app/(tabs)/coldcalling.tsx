import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle, Card, SectionHeader, StatusBadge, Avatar, AISummary, RedButton } from '../../components/ui';
import { generateCallSummary } from '../../lib/ai';
import { notifyCallLogged } from '../../lib/notifications';
import { format } from 'date-fns';

export default function ColdCallingScreen() {
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  // Voice note modal
  const [voiceModal, setVoiceModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedLeadName, setSelectedLeadName] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [callNote, setCallNote] = useState('');
  const [callOutcome, setCallOutcome] = useState('Interested');
  const timerRef = useRef<any>(null);

  const OUTCOMES = ['Interested', 'Callback', 'Not interested', 'No answer', 'Won', 'Meeting set'];

  async function fetchData() {
    const today = new Date().toISOString().slice(0, 10);
    const [logsRes, leadsRes] = await Promise.all([
      supabase.from('call_logs')
        .select('id, lead_id, lead_name, duration, outcome, ai_summary, created_at, notes')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name, phone, status').order('status'),
    ]);
    if (logsRes.data) { setCallLogs(logsRes.data); setTodayCount(logsRes.data.length); }
    if (leadsRes.data) setLeads(leadsRes.data);
  }

  useEffect(() => { fetchData(); }, []);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  // ── Voice recording ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording. Check microphone permission.');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    // In production: send audio URI to Whisper/Google Speech-to-Text for transcription
    // For now we use the manual note the agent types
    setRecording(null);
  }

  async function saveCallLog() {
    if (!selectedLeadId) { Alert.alert('Select a lead first'); return; }
    if (!callNote.trim()) { Alert.alert('Add a voice note or type what was discussed'); return; }

    setAiLoading(true);
    const summary = await generateCallSummary(callNote, selectedLeadName);
    setAiLoading(false);

    const { error } = await supabase.from('call_logs').insert({
      lead_id: selectedLeadId,
      lead_name: selectedLeadName,
      outcome: callOutcome,
      notes: callNote,
      ai_summary: summary,
      duration: recordSeconds,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      await supabase.from('leads').update({
        last_contacted_at: new Date().toISOString(),
        status: callOutcome === 'Won' ? 'Won' : callOutcome === 'Not interested' ? 'Cold' : undefined,
      }).eq('id', selectedLeadId);

      await notifyCallLogged(selectedLeadName);
      setVoiceModal(false);
      resetModal();
      fetchData();
    }
  }

  function resetModal() {
    setSelectedLeadId('');
    setSelectedLeadName('');
    setCallNote('');
    setCallOutcome('Interested');
    setRecordSeconds(0);
  }

  function outcomeColor(outcome: string) {
    if (outcome === 'Interested' || outcome === 'Won' || outcome === 'Meeting set') return COLORS.green;
    if (outcome === 'Callback') return COLORS.amber;
    return COLORS.muted;
  }

  return (
    <View style={s.container}>
      <ProwinHeader
        rightContent={
          <View style={s.countPill}>
            <Ionicons name="call-outline" size={13} color={COLORS.green} />
            <Text style={s.countText}>{todayCount} / 10 today</Text>
          </View>
        }
      />
      <PageTitle label="CRM · Cold calling" title="Call Log" />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
      >
        {/* Log button */}
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <RedButton
            label="Log new call + voice note"
            onPress={() => setVoiceModal(true)}
            icon="mic-outline"
          />
        </View>

        {/* Progress bar */}
        <View style={s.progCard}>
          <Text style={s.progLabel}>TODAY'S TARGET</Text>
          <View style={s.progTrack}>
            <View style={[s.progFill, { width: `${Math.min((todayCount / 10) * 100, 100)}%` }]} />
          </View>
          <Text style={s.progSub}>{todayCount} of 10 calls · {10 - todayCount > 0 ? `${10 - todayCount} to go` : 'Target reached!'}</Text>
        </View>

        <SectionHeader title={`today's call log · ${format(new Date(), 'EEE d MMM')}`} />

        {callLogs.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="call-outline" size={44} color={COLORS.muted} />
            <Text style={s.emptyText}>No calls logged today yet</Text>
            <Text style={s.emptySubText}>Tap the button above to log your first call</Text>
          </View>
        )}

        {callLogs.map((log) => (
          <Card key={log.id} topColor={COLORS.red} style={{ marginHorizontal: 14 }}>
            <View style={s.logTop}>
              <View>
                <Text style={s.logName}>{log.lead_name}</Text>
                <View style={s.logMeta}>
                  <Ionicons name="time-outline" size={11} color={COLORS.muted} />
                  <Text style={s.logMetaText}>
                    {format(new Date(log.created_at), 'HH:mm')}
                    {log.duration > 0 && ` · ${log.duration}s`}
                  </Text>
                </View>
              </View>
              <View style={[s.outcomePill, { backgroundColor: outcomeColor(log.outcome) + '22', borderColor: outcomeColor(log.outcome) + '44' }]}>
                <Text style={[s.outcomeText, { color: outcomeColor(log.outcome) }]}>{log.outcome}</Text>
              </View>
            </View>
            {log.ai_summary && <AISummary text={log.ai_summary} />}
            {log.notes && !log.ai_summary && (
              <View style={s.noteBox}>
                <Text style={s.noteText}>{log.notes}</Text>
              </View>
            )}
          </Card>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Voice Note Modal ──────────────────────────────────── */}
      <Modal visible={voiceModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Log a call</Text>
            <TouchableOpacity onPress={() => { setVoiceModal(false); resetModal(); }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody}>
            {/* Pick lead */}
            <Text style={s.fieldLabel}>SELECT LEAD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {leads.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[s.leadChip, selectedLeadId === l.id && s.leadChipActive]}
                  onPress={() => { setSelectedLeadId(l.id); setSelectedLeadName(l.name); }}
                >
                  <Text style={[s.leadChipText, selectedLeadId === l.id && s.leadChipTextActive]}>{l.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Outcome */}
            <Text style={s.fieldLabel}>CALL OUTCOME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {OUTCOMES.map(o => (
                <TouchableOpacity
                  key={o}
                  style={[s.leadChip, callOutcome === o && s.leadChipActive]}
                  onPress={() => setCallOutcome(o)}
                >
                  <Text style={[s.leadChipText, callOutcome === o && s.leadChipTextActive]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Voice note */}
            <Text style={s.fieldLabel}>VOICE NOTE</Text>
            <View style={s.recBox}>
              <TouchableOpacity
                style={[s.recBtn, isRecording && s.recBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={28} color={isRecording ? '#fff' : COLORS.red} />
                <Text style={[s.recBtnText, isRecording && { color: '#fff' }]}>
                  {isRecording ? `Recording... ${recordSeconds}s (tap to stop)` : 'Tap to record voice note'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.fieldLabel, { marginTop: 12 }]}>OR TYPE WHAT WAS DISCUSSED</Text>
            <TextInput
              style={s.noteInput}
              placeholder="e.g. Client is looking for 2BR in JVC, budget 1.2M, wants to view this weekend..."
              placeholderTextColor={COLORS.muted}
              value={callNote}
              onChangeText={setCallNote}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <View style={s.aiInfoBox}>
              <Ionicons name="sparkles" size={14} color={COLORS.red} />
              <Text style={s.aiInfoText}>AI will read your note and write a professional CRM summary automatically when you save.</Text>
            </View>

            {aiLoading
              ? (
                <View style={s.savingRow}>
                  <ActivityIndicator color={COLORS.red} />
                  <Text style={s.savingText}>AI is generating summary...</Text>
                </View>
              )
              : (
                <TouchableOpacity style={s.saveBtn} onPress={saveCallLog}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Save call log</Text>
                </TouchableOpacity>
              )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.greenLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.greenBorder },
  countText: { fontSize: 12, fontWeight: '700', color: COLORS.green },
  progCard: { margin: 14, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  progLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5, marginBottom: 8 },
  progTrack: { height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progFill: { height: '100%', backgroundColor: COLORS.red, borderRadius: 4 },
  progSub: { fontSize: 11, color: COLORS.muted },
  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 40, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.muted },
  emptySubText: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  logName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  logMetaText: { fontSize: 11, color: COLORS.muted },
  outcomePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  outcomeText: { fontSize: 11, fontWeight: '700' },
  noteBox: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 10 },
  noteText: { fontSize: 12, color: COLORS.muted, lineHeight: 18 },
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalBody: { flex: 1, padding: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5, marginBottom: 8 },
  leadChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, marginRight: 8 },
  leadChipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  leadChipText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  leadChipTextActive: { color: '#fff' },
  recBox: { marginBottom: 12 },
  recBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 2, borderColor: COLORS.red, borderRadius: 14, borderStyle: 'dashed', paddingVertical: 18 },
  recBtnActive: { backgroundColor: COLORS.red, borderStyle: 'solid' },
  recBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.red },
  noteInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text, minHeight: 110 },
  aiInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.redLight, borderRadius: 10, padding: 10, marginTop: 12, marginBottom: 16 },
  aiInfoText: { flex: 1, fontSize: 12, color: COLORS.red, lineHeight: 18 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 14 },
  savingText: { fontSize: 14, color: COLORS.muted },
  saveBtn: { backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
