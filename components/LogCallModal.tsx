import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { COLORS } from '../lib/supabase';
import { CALL_RESULT_OPTIONS, mapCallResultToContactStatus, saveColdCallLog } from '../lib/callLog';
import { scheduleFollowUpReminder } from '../lib/notifications';
import { getContactName } from '../lib/contactName';
import { ColdCallContactListItem } from '../lib/coldCallContact';
import type { CallDurationSource } from '../lib/androidCallLog';
import { SafeScreenHeader } from './SafeScreenHeader';
import { ContactNavRow } from './ContactNavRow';
import { ActionButtons } from './ui';

type Props = {
  visible: boolean;
  contact: ColdCallContactListItem | null;
  selectedAgentId: string | null;
  selectedAgentName: string;
  /** When true after an auto-opened dial, duration is read-only. Manual open keeps false. */
  durationLocked?: boolean;
  /** call_log = locked real seconds; timer = locked/fallback minutes; manual/undefined = editable minutes. */
  durationSource?: CallDurationSource | 'manual' | null;
  /** True seconds when durationSource === 'call_log' (do not round to minutes). */
  lockedDurationSeconds?: number;
  /** Minutes field for timer fallback / manual entry. */
  initialDurationMinutes?: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSaved: () => void;
  onCall: (contact: ColdCallContactListItem) => void;
  onWhatsApp: (contact: ColdCallContactListItem) => void;
  onEmail: (contact: ColdCallContactListItem) => void;
};

function formatLockedSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function LogCallModal({
  visible,
  contact,
  selectedAgentId,
  selectedAgentName,
  durationLocked = false,
  durationSource = null,
  lockedDurationSeconds = 0,
  initialDurationMinutes = '0',
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onSaved,
  onCall,
  onWhatsApp,
  onEmail,
}: Props) {
  const [callResult, setCallResult] = useState<string>(CALL_RESULT_OPTIONS[0]);
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [callNotes, setCallNotes] = useState('');
  const [interestLevel, setInterestLevel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [followUpAt, setFollowUpAt] = useState<Date | null>(null);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);

  const useCallLogSeconds = durationLocked && durationSource === 'call_log';

  useEffect(() => {
    if (!visible || !contact) return;
    setCallResult(CALL_RESULT_OPTIONS[0]);
    setDurationMinutes(initialDurationMinutes);
    setCallNotes('');
    setInterestLevel(null);
    setFollowUpAt(null);
    setShowFollowUpPicker(false);
  }, [visible, contact?.id, initialDurationMinutes, durationSource, lockedDurationSeconds]);

  async function handleSave() {
    if (!contact || !selectedAgentId) {
      Alert.alert('Select a contact');
      return;
    }

    const durationSeconds = useCallLogSeconds
      ? Math.max(0, Math.round(lockedDurationSeconds))
      : (() => {
          const mins = parseInt(durationMinutes, 10);
          return Number.isFinite(mins) && mins >= 0 ? mins * 60 : 0;
        })();

    const contactStatus = mapCallResultToContactStatus(callResult);
    const followUpDateIso = followUpAt ? format(followUpAt, 'yyyy-MM-dd') : null;

    setSaving(true);
    try {
      await saveColdCallLog({
        contactId: contact.id,
        listId: contact.list_id,
        agentId: selectedAgentId,
        agentName: selectedAgentName,
        callResult,
        durationSeconds,
        notes: callNotes,
        interestLevel,
        followUpDate: followUpDateIso,
        contactStatus,
      });

      if (followUpAt && followUpAt > new Date()) {
        await scheduleFollowUpReminder(
          contact.id,
          getContactName(contact),
          contact.phone,
          followUpAt,
        );
      }

      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save call log');
    }
    setSaving(false);
  }

  function onFollowUpChange(event: { type: string }, date?: Date) {
    if (Platform.OS === 'android') setShowFollowUpPicker(false);
    if (event.type === 'dismissed') return;
    if (date) setFollowUpAt(date);
  }

  if (!contact) return null;

  const displayName = getContactName(contact);
  const hasEmail = Boolean(contact.email?.trim());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={s.container}>
        <SafeScreenHeader
          title="Log a call"
          onClose={onClose}
          centerContent={
            <ContactNavRow
              name={displayName}
              onPrev={onPrev}
              onNext={onNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          }
        />

        <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
          <ActionButtons
            onCall={() => onCall(contact)}
            onWhatsApp={() => onWhatsApp(contact)}
            onEmail={() => onEmail(contact)}
            onView={() => {}}
            emailDisabled={!hasEmail}
          />

          <Text style={[s.fieldLabel, { marginTop: 14 }]}>CALL RESULT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {CALL_RESULT_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.chip, callResult === r && s.chipActive]}
                onPress={() => setCallResult(r)}
              >
                <Text style={[s.chipText, callResult === r && s.chipTextActive]} numberOfLines={1}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.fieldLabel}>TALK TIME</Text>
          {useCallLogSeconds ? (
            <View style={s.lockedDurationBox}>
              <View style={s.lockedDurationRow}>
                <Ionicons name="lock-closed" size={16} color={COLORS.green} />
                <Text style={s.lockedDurationValue}>
                  Call duration: {formatLockedSeconds(lockedDurationSeconds)}
                </Text>
              </View>
              <Text style={s.lockedHintGreen}>From phone log — locked</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={[s.input, durationLocked && s.inputLocked]}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.muted}
                value={durationMinutes}
                onChangeText={durationLocked ? undefined : setDurationMinutes}
                editable={!durationLocked}
              />
              {durationLocked && durationSource === 'timer' ? (
                <Text style={s.lockedHintAmber}>
                  Couldn&apos;t read call duration from phone — using timer (minutes).
                </Text>
              ) : durationLocked ? (
                <Text style={s.lockedHint}>Auto-filled from call timer (read-only)</Text>
              ) : (
                <Text style={s.lockedHint}>Enter talk time in minutes</Text>
              )}
            </>
          )}

          {callResult === 'Connected - Interested' && (
            <>
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>INTEREST LEVEL</Text>
              <View style={s.interestRow}>
                {['Hot', 'Warm', 'Cold'].map(level => (
                  <TouchableOpacity
                    key={level}
                    style={[s.chip, interestLevel === level && s.chipActive]}
                    onPress={() => setInterestLevel(level)}
                  >
                    <Text style={[s.chipText, interestLevel === level && s.chipTextActive]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={[s.fieldLabel, { marginTop: 12 }]}>NOTES</Text>
          <TextInput
            style={[s.input, s.notesInput]}
            placeholder="What was discussed..."
            placeholderTextColor={COLORS.muted}
            value={callNotes}
            onChangeText={setCallNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={[s.fieldLabel, { marginTop: 12 }]}>SCHEDULE FOLLOW-UP</Text>
          <TouchableOpacity style={s.followUpBtn} onPress={() => setShowFollowUpPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.red} />
            <Text style={s.followUpText}>
              {followUpAt
                ? format(followUpAt, 'EEE d MMM yyyy · HH:mm')
                : 'Pick date & time'}
            </Text>
          </TouchableOpacity>
          {followUpAt && (
            <TouchableOpacity onPress={() => setFollowUpAt(null)} style={s.clearFollowUp}>
              <Text style={s.clearFollowUpText}>Clear follow-up</Text>
            </TouchableOpacity>
          )}

          <Text style={s.hintText}>
            Contact status will update to: {mapCallResultToContactStatus(callResult)}
          </Text>

          {saving ? (
            <View style={s.savingRow}>
              <ActivityIndicator color={COLORS.red} />
              <Text style={s.savingText}>Saving...</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={s.saveBtnText}>Save call log</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      {showFollowUpPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={followUpAt ?? new Date()}
          mode="datetime"
          display="default"
          onChange={onFollowUpChange}
        />
      )}

      {showFollowUpPicker && Platform.OS === 'ios' && (
        <Modal visible transparent animationType="slide">
          <View style={s.pickerOverlay}>
            <View style={s.pickerSheet}>
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>Follow-up date & time</Text>
                <TouchableOpacity onPress={() => setShowFollowUpPicker(false)}>
                  <Text style={s.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={followUpAt ?? new Date()}
                mode="datetime"
                display="spinner"
                onChange={onFollowUpChange}
              />
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, padding: 16 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6, marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  chipTextActive: { color: '#fff' },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: COLORS.text,
  },
  inputLocked: { backgroundColor: COLORS.bg, color: COLORS.muted },
  lockedHint: { marginTop: 6, fontSize: 11, color: COLORS.muted },
  lockedHintAmber: { marginTop: 6, fontSize: 11, fontWeight: '600', color: COLORS.amber },
  lockedHintGreen: { marginTop: 4, fontSize: 11, fontWeight: '700', color: COLORS.green },
  lockedDurationBox: {
    backgroundColor: '#e9f7ef',
    borderWidth: 1,
    borderColor: '#b7e4c9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  lockedDurationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedDurationValue: { fontSize: 14, fontWeight: '800', color: COLORS.text, flexShrink: 1 },
  notesInput: { minHeight: 90, textAlignVertical: 'top' },
  followUpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
  },
  followUpText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  clearFollowUp: { marginTop: 8 },
  clearFollowUpText: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  hintText: { marginTop: 14, fontSize: 12, color: COLORS.muted },
  savingRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  savingText: { fontSize: 13, color: COLORS.muted },
  saveBtn: {
    marginTop: 18, backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  pickerDone: { fontSize: 14, fontWeight: '700', color: COLORS.red },
});
