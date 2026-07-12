import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format } from 'date-fns';
import { supabase, COLORS } from '../lib/supabase';
import { getUserDisplayName, type CrmUser } from '../hooks/useCrmSession';

const LEAVE_TYPES = ['Annual', 'Sick', 'Unpaid', 'Emergency', 'Maternity'] as const;

function inclusiveLeaveDays(start: Date, end: Date): number {
  return differenceInCalendarDays(end, start) + 1;
}

type LeaveRequestModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  user: CrmUser | null;
};

export function LeaveRequestModal({
  visible,
  onClose,
  onSubmitted,
  user,
}: LeaveRequestModalProps) {
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>('Annual');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveSaveError, setLeaveSaveError] = useState<string | null>(null);

  const resetLeaveForm = useCallback(() => {
    setLeaveType('Annual');
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
    setEndDate(d);
    setLeaveReason('');
    setLeaveSaveError(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
  }, []);

  const handleClose = useCallback(() => {
    resetLeaveForm();
    onClose();
  }, [resetLeaveForm, onClose]);

  const saveLeaveRequest = useCallback(async () => {
    if (!user?.id) {
      setLeaveSaveError('You must be signed in to request leave.');
      return;
    }
    if (!leaveType) {
      setLeaveSaveError('Leave type is required.');
      return;
    }
    if (endDate < startDate) {
      setLeaveSaveError('End date must be on or after start date.');
      return;
    }

    setSavingLeave(true);
    setLeaveSaveError(null);

    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    const days = inclusiveLeaveDays(startDate, endDate);
    const reason = leaveReason.trim() || null;

    const { error } = await supabase.from('leaves').insert({
      employee_id: user.id,
      employee_name: getUserDisplayName(user),
      leave_type: leaveType,
      start_date: start,
      end_date: end,
      days,
      reason,
      status: 'Pending',
      approved_by_id: null,
      approved_by_name: null,
      approver_notes: null,
    });

    setSavingLeave(false);

    if (error) {
      setLeaveSaveError(error.message);
      return;
    }

    resetLeaveForm();
    await Promise.resolve(onSubmitted());
    onClose();
    Alert.alert('Success', 'Leave request submitted.');
  }, [user, leaveType, startDate, endDate, leaveReason, resetLeaveForm, onSubmitted, onClose]);

  const modalMaxHeight = Dimensions.get('window').height * 0.9;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.modalSheet, { maxHeight: modalMaxHeight }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Request Leave</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.requestModalBody}
            contentContainerStyle={s.requestModalBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.fieldLabel}>LEAVE TYPE *</Text>
            <View style={s.typeWrap}>
              {LEAVE_TYPES.map((type) => {
                const selected = leaveType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[s.typeChip, selected && s.typeChipOn]}
                    onPress={() => setLeaveType(type)}
                  >
                    <Text style={[s.typeChipText, selected && s.typeChipTextOn]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.fieldLabel}>START DATE *</Text>
            <TouchableOpacity style={s.input} onPress={() => setShowStartPicker(true)}>
              <Text style={s.pickerText}>{format(startDate, 'EEE d MMM yyyy')}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowStartPicker(Platform.OS === 'ios');
                  if (d) {
                    const next = new Date(d);
                    next.setHours(0, 0, 0, 0);
                    setStartDate(next);
                    if (endDate < next) setEndDate(next);
                  }
                }}
              />
            )}

            <Text style={s.fieldLabel}>END DATE *</Text>
            <TouchableOpacity style={s.input} onPress={() => setShowEndPicker(true)}>
              <Text style={s.pickerText}>{format(endDate, 'EEE d MMM yyyy')}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowEndPicker(Platform.OS === 'ios');
                  if (d) {
                    const next = new Date(d);
                    next.setHours(0, 0, 0, 0);
                    setEndDate(next);
                  }
                }}
              />
            )}

            <Text style={s.daysHint}>
              Days: {inclusiveLeaveDays(startDate, endDate)}
            </Text>

            <Text style={s.fieldLabel}>REASON</Text>
            <TextInput
              style={[s.input, s.reasonInput]}
              placeholder="Optional reason"
              placeholderTextColor={COLORS.muted}
              value={leaveReason}
              onChangeText={setLeaveReason}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          {leaveSaveError ? <Text style={s.errorText}>{leaveSaveError}</Text> : null}

          <View style={s.modalFooter}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleClose}
              disabled={savingLeave}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, savingLeave && s.btnDisabled]}
              onPress={() => void saveLeaveRequest()}
              disabled={savingLeave}
            >
              {savingLeave ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 12 },
  requestModalBody: { flexGrow: 0 },
  requestModalBodyContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 10,
  },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  typeChipOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  typeChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  typeChipTextOn: { color: '#fff' },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pickerText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  daysHint: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginTop: 8 },
  reasonInput: { minHeight: 90, paddingTop: 11, fontSize: 14, color: COLORS.text },
  errorText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
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
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.red,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
});
