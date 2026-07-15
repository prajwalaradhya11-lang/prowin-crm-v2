import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { THEME } from '../../lib/prowinTheme';
import { getName, type LeadNameFields } from '../../lib/leadName';
import { getLeadInterest, INTEREST_OPTIONS } from '../../lib/leadFields';
import { fetchActiveStatusOptions, fetchActiveReasonOptions } from '../../lib/leadStatus';
import {
  CALL_OUTCOME_OPTIONS,
  type CallOutcomeId,
  formatTalkDuration,
  isFollowUpValid,
  followUpValidationHint,
  statusRequiresFollowUp,
} from '../../lib/leadLogCallSheet';
import { saveLeadSheetUpdate, prefetchStatusFromOutcome } from '../../lib/leadSheetSave';
import type { CallDurationSource } from '../../lib/androidCallLog';

export type LogCallSheetMode = 'log-call' | 'change-status';

type LeadForSheet = LeadNameFields & {
  id: string;
  phone?: string | null;
  lead_status?: string | null;
  status?: string | null;
  status_reason?: string | null;
  priority?: string | null;
  follow_up_date?: string | null;
  follow_up_time?: string | null;
  is_archived?: boolean | null;
  project?: string | null;
  communities?: string | null;
  bedrooms?: string | null;
  budget?: unknown;
  property_type?: string | null;
  purpose?: string | null;
};

type LogCallSheetProps = {
  visible: boolean;
  mode: LogCallSheetMode;
  lead: LeadForSheet | null;
  durationSeconds?: number;
  /** call_log = locked from phone; timer = dial fallback; manual = user opened log without dial. */
  durationSource?: CallDurationSource | 'manual';
  doneBy: string;
  agentId: string | null;
  agentName: string;
  onClose: () => void;
  onSaved: () => void;
};

function parseFollowUp(lead: LeadForSheet): Date | null {
  if (!lead.follow_up_date?.trim()) return null;
  try {
    const iso = lead.follow_up_time?.trim()
      ? `${lead.follow_up_date}T${lead.follow_up_time}`
      : lead.follow_up_date;
    const d = parseISO(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function LogCallSheet({
  visible,
  mode,
  lead,
  durationSeconds = 0,
  durationSource = 'manual',
  doneBy,
  agentId,
  agentName,
  onClose,
  onSaved,
}: LogCallSheetProps) {
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [reasonOptions, setReasonOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [callOutcome, setCallOutcome] = useState<CallOutcomeId | null>(null);
  const [status, setStatus] = useState('');
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [interest, setInterest] = useState('Warm');
  const [followUpAt, setFollowUpAt] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [project, setProject] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [budget, setBudget] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [purpose, setPurpose] = useState('');

  const [statusListOpen, setStatusListOpen] = useState(false);
  const [reasonListOpen, setReasonListOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [statuses, reasons] = await Promise.all([
        fetchActiveStatusOptions(),
        fetchActiveReasonOptions(),
      ]);
      setStatusOptions(statuses.map(o => o.name));
      setReasonOptions(reasons.map(o => o.name));
    } catch (e: any) {
      Alert.alert('Could not load options', e.message ?? 'Unknown error');
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !lead) return;
    void loadOptions();
    const leadStatus = lead.lead_status ?? lead.status ?? '';
    setStatus(leadStatus);
    setStatusReason(lead.status_reason ?? null);
    setInterest(getLeadInterest(lead));
    setFollowUpAt(parseFollowUp(lead));
    setNote('');
    setCallOutcome(null);
    setRequirementsOpen(false);
    setProject(lead.project ?? lead.communities ?? '');
    setBedrooms(lead.bedrooms ?? '');
    setBudget(lead.budget != null ? String(lead.budget) : '');
    setPropertyType(lead.property_type ?? '');
    setPurpose(lead.purpose ?? '');
    setStatusListOpen(false);
    setReasonListOpen(false);
  }, [visible, lead?.id, loadOptions]);

  const followUpInvalid = useMemo(
    () => !isFollowUpValid(status, followUpAt),
    [status, followUpAt],
  );

  const canSave = useMemo(() => {
    if (!status.trim()) return false;
    if (mode === 'log-call' && !callOutcome) return false;
    if (followUpInvalid) return false;
    return true;
  }, [status, mode, callOutcome, followUpInvalid]);

  async function handleOutcomeSelect(outcomeId: CallOutcomeId) {
    setCallOutcome(outcomeId);
    try {
      const { status: prefilled, archivesLead } = await prefetchStatusFromOutcome(outcomeId);
      if (prefilled) setStatus(prefilled);
      if (archivesLead) {
        Alert.alert('Archive', 'This outcome will archive the lead on save.');
      }
    } catch {
      // keep current status
    }
  }

  async function handleSave() {
    if (!lead || !canSave) return;
    setSaving(true);
    try {
      await saveLeadSheetUpdate({
        leadId: lead.id,
        leadName: getName(lead),
        mode,
        doneBy,
        agentId,
        agentName,
        current: {
          status: lead.lead_status ?? lead.status ?? '',
          statusReason: lead.status_reason ?? null,
          interest: getLeadInterest(lead),
          followUpDate: lead.follow_up_date ?? null,
          followUpTime: lead.follow_up_time ?? null,
          isArchived: lead.is_archived === true,
          project: lead.project ?? null,
          bedrooms: lead.bedrooms ?? null,
          budget: lead.budget,
          propertyType: lead.property_type ?? null,
          purpose: lead.purpose ?? null,
          communities: lead.communities ?? null,
        },
        status,
        statusReason,
        interest,
        followUpAt,
        note,
        callOutcome: mode === 'log-call' ? callOutcome : null,
        durationSeconds,
        requirementUpdates: { project, bedrooms, budget, propertyType, purpose },
      });
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Could not save. No changes were applied.');
    } finally {
      setSaving(false);
    }
  }

  if (!lead) return null;

  const title = mode === 'log-call' ? 'Log call outcome' : 'Change status';
  const displayName = getName(lead);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {mode === 'log-call' && (
              <View style={s.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.summaryName}>{displayName}</Text>
                  {lead.phone ? <Text style={s.summaryPhone}>{lead.phone}</Text> : null}
                </View>
                <View style={s.durationCol}>
                  {durationSource === 'call_log' ? (
                    <>
                      <View style={s.durationLockedRow}>
                        <Ionicons name="lock-closed" size={14} color={THEME.green} />
                        <Text style={s.summaryDurationLocked}>{formatTalkDuration(durationSeconds)}</Text>
                      </View>
                      <Text style={s.durationSourceLocked}>From phone log — locked</Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.summaryDuration}>{formatTalkDuration(durationSeconds)}</Text>
                      {durationSource === 'timer' ? (
                        <Text style={s.durationSourceFallback}>
                          Couldn&apos;t read call duration — using timer.
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            )}

            {mode === 'log-call' && (
              <>
                <Text style={s.sectionLabel}>Call outcome</Text>
                <View style={s.pillRow}>
                  {CALL_OUTCOME_OPTIONS.map(opt => {
                    const active = callOutcome === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[s.pill, active && s.pillActive]}
                        onPress={() => handleOutcomeSelect(opt.id)}
                      >
                        <Text style={[s.pillText, active && s.pillTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={s.sectionLabel}>Status</Text>
            {loadingOptions ? (
              <ActivityIndicator color={THEME.red} style={{ marginVertical: 8 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={s.dropdownTrigger}
                  onPress={() => setStatusListOpen(v => !v)}
                >
                  <Text style={status ? s.dropdownValue : s.dropdownPlaceholder}>
                    {status || 'Select pipeline status'}
                  </Text>
                  <Ionicons
                    name={statusListOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={THEME.meta}
                  />
                </TouchableOpacity>
                {statusListOpen && (
                  <View style={s.dropdownList}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                      {statusOptions.length === 0 ? (
                        <Text style={s.emptyOptions}>No statuses loaded</Text>
                      ) : (
                        statusOptions.map(opt => (
                          <TouchableOpacity
                            key={opt}
                            style={[s.dropdownItem, status === opt && s.dropdownItemActive]}
                            onPress={() => { setStatus(opt); setStatusListOpen(false); }}
                          >
                            <Text style={s.dropdownItemText}>{opt}</Text>
                            {status === opt && (
                              <Ionicons name="checkmark" size={16} color={THEME.red} />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            <Text style={s.sectionLabel}>Status reason</Text>
            <TouchableOpacity
              style={s.dropdownTrigger}
              onPress={() => setReasonListOpen(v => !v)}
            >
              <Text style={statusReason ? s.dropdownValue : s.dropdownPlaceholder}>
                {statusReason || 'Select reason (optional)'}
              </Text>
              <Ionicons
                name={reasonListOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={THEME.meta}
              />
            </TouchableOpacity>
            {reasonListOpen && (
              <View style={s.dropdownList}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}>
                  <TouchableOpacity
                    style={s.dropdownItem}
                    onPress={() => { setStatusReason(null); setReasonListOpen(false); }}
                  >
                    <Text style={s.dropdownItemText}>— None —</Text>
                  </TouchableOpacity>
                  {reasonOptions.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.dropdownItem, statusReason === opt && s.dropdownItemActive]}
                      onPress={() => { setStatusReason(opt); setReasonListOpen(false); }}
                    >
                      <Text style={s.dropdownItemText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={s.sectionLabel}>Interest</Text>
            <View style={s.pillRow}>
              {INTEREST_OPTIONS.map(tag => {
                const active = interest === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[s.pill, active && s.pillActiveInterest]}
                    onPress={() => setInterest(tag)}
                  >
                    <Text style={[s.pillText, active && s.pillTextActiveInterest]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>Next follow-up</Text>
            <View style={s.followRow}>
              <TouchableOpacity
                style={[s.pickerBtn, followUpInvalid && s.pickerBtnError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={16} color={followUpInvalid ? THEME.red : THEME.meta} />
                <Text style={s.pickerBtnText}>
                  {followUpAt ? format(followUpAt, 'EEE d MMM yyyy') : 'Pick date'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.pickerBtn, followUpInvalid && s.pickerBtnError]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={16} color={followUpInvalid ? THEME.red : THEME.meta} />
                <Text style={s.pickerBtnText}>
                  {followUpAt ? format(followUpAt, 'h:mm a') : 'Pick time'}
                </Text>
              </TouchableOpacity>
            </View>
            {followUpInvalid && statusRequiresFollowUp(status) && (
              <Text style={s.errorHint}>{followUpValidationHint(status)}</Text>
            )}

            <Text style={s.sectionLabel}>Note</Text>
            <View style={s.noteRow}>
              <TextInput
                style={s.noteInput}
                placeholder="Add a note..."
                placeholderTextColor={THEME.meta}
                value={note}
                onChangeText={setNote}
                multiline
              />
              <TouchableOpacity
                style={s.micBtn}
                onPress={() => Alert.alert('Voice note', 'Voice recording coming soon.')}
              >
                <Ionicons name="mic" size={18} color={THEME.red} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.collapseHeader}
              onPress={() => setRequirementsOpen(v => !v)}
            >
              <Text style={s.collapseTitle}>Update budget / project / requirement</Text>
              <Ionicons
                name={requirementsOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={THEME.meta}
              />
            </TouchableOpacity>
            {requirementsOpen && (
              <View style={s.requirementsBox}>
                <TextInput style={s.reqInput} placeholder="Project" value={project} onChangeText={setProject} placeholderTextColor={THEME.meta} />
                <TextInput style={s.reqInput} placeholder="Beds" value={bedrooms} onChangeText={setBedrooms} placeholderTextColor={THEME.meta} />
                <TextInput style={s.reqInput} placeholder="Budget" value={budget} onChangeText={setBudget} keyboardType="numeric" placeholderTextColor={THEME.meta} />
                <TextInput style={s.reqInput} placeholder="Property type" value={propertyType} onChangeText={setPropertyType} placeholderTextColor={THEME.meta} />
                <TextInput style={s.reqInput} placeholder="Purpose" value={purpose} onChangeText={setPurpose} placeholderTextColor={THEME.meta} />
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  {!canSave && followUpInvalid && statusRequiresFollowUp(status) ? (
                    <Ionicons name="lock-closed" size={14} color="#fff" style={{ marginRight: 4 }} />
                  ) : null}
                  <Text style={s.saveBtnText}>
                    {!canSave && followUpInvalid && statusRequiresFollowUp(status)
                      ? 'Set follow-up to save'
                      : 'Save & update lead'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={followUpAt ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(_, d) => {
            if (Platform.OS === 'android') setShowDatePicker(false);
            if (d) {
              setFollowUpAt(prev => {
                const base = prev ?? new Date();
                const next = new Date(d);
                next.setHours(base.getHours(), base.getMinutes(), 0, 0);
                return next;
              });
            }
          }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={followUpAt ?? new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            if (Platform.OS === 'android') setShowTimePicker(false);
            if (d) {
              setFollowUpAt(prev => {
                const base = prev ?? new Date();
                const next = new Date(base);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                return next;
              });
            }
          }}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
  },
  header: {
    backgroundColor: THEME.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  body: { maxHeight: '100%' },
  bodyContent: { padding: 16, paddingBottom: 8 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.page,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  summaryName: { fontSize: 15, fontWeight: '800', color: THEME.heading },
  summaryPhone: { fontSize: 12, color: THEME.red, marginTop: 2 },
  summaryDuration: { fontSize: 13, fontWeight: '700', color: THEME.green },
  durationCol: { alignItems: 'flex-end', maxWidth: '46%', gap: 2 },
  durationLockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryDurationLocked: { fontSize: 13, fontWeight: '800', color: THEME.green },
  durationSourceLocked: { fontSize: 10, fontWeight: '600', color: THEME.green, textAlign: 'right' },
  durationSourceFallback: { fontSize: 10, fontWeight: '600', color: THEME.amber, textAlign: 'right' },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
  },
  pillActive: { backgroundColor: THEME.redTintFill, borderColor: THEME.red },
  pillText: { fontSize: 12, fontWeight: '700', color: THEME.meta },
  pillTextActive: { color: THEME.red },
  pillActiveInterest: { backgroundColor: THEME.redTintFill, borderColor: THEME.redTintBorder },
  pillTextActiveInterest: { color: THEME.red },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: THEME.page,
  },
  dropdownPlaceholder: { fontSize: 14, color: THEME.meta },
  dropdownValue: { fontSize: 14, fontWeight: '700', color: THEME.heading },
  dropdownList: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  dropdownItemActive: { backgroundColor: THEME.redTintFill },
  dropdownItemText: { fontSize: 13, fontWeight: '600', color: THEME.heading },
  emptyOptions: { padding: 12, color: THEME.meta, fontSize: 13 },
  followRow: { flexDirection: 'row', gap: 8 },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: THEME.page,
  },
  pickerBtnError: { borderColor: THEME.red, borderWidth: 2 },
  pickerBtnText: { fontSize: 12, fontWeight: '600', color: THEME.heading },
  errorHint: { fontSize: 11, fontWeight: '700', color: THEME.red, marginTop: 4 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  noteInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.heading,
    backgroundColor: THEME.page,
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.redTintBorder,
    backgroundColor: THEME.redTintFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  collapseTitle: { fontSize: 13, fontWeight: '700', color: THEME.heading },
  requirementsBox: { gap: 8, paddingBottom: 8 },
  reqInput: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.heading,
    backgroundColor: THEME.page,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: THEME.meta },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: THEME.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#d8a49c', opacity: 0.85 },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
