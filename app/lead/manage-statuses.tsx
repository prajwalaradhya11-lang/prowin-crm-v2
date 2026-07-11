import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../lib/supabase';
import { SafeScreenHeader } from '../../components/SafeScreenHeader';
import { useCrmSession } from '../../hooks/useCrmSession';
import {
  LeadOption,
  fetchAllStatusOptions,
  fetchAllReasonOptions,
  addStatusOption,
  addReasonOption,
  deactivateStatusOption,
  deactivateReasonOption,
  deleteStatusOption,
  deleteReasonOption,
} from '../../lib/leadStatus';
import { isArchiveLeadStatus } from '../../lib/leadFields';

function OptionList({
  title,
  items,
  newName,
  onChangeName,
  onAdd,
  onDeactivate,
  onDelete,
  adding,
}: {
  title: string;
  items: LeadOption[];
  newName: string;
  onChangeName: (v: string) => void;
  onAdd: () => void;
  onDeactivate: (item: LeadOption) => void;
  onDelete: (item: LeadOption) => void;
  adding: boolean;
}) {
  return (
    <View style={s.listPanel}>
      <Text style={s.panelTitle}>{title}</Text>

      <View style={s.addRow}>
        <TextInput
          style={s.addInput}
          placeholder="New option name"
          placeholderTextColor={COLORS.muted}
          value={newName}
          onChangeText={onChangeName}
        />
        <TouchableOpacity style={s.addBtn} onPress={onAdd} disabled={adding}>
          {adding
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.addBtnText}>Add</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.listScroll} nestedScrollEnabled>
        {items.map(item => (
          <View key={item.id} style={[s.row, !item.is_active && s.rowInactive]}>
            <Text style={[s.rowName, !item.is_active && s.rowNameInactive]} numberOfLines={2}>
              {item.name}
              {!item.is_active && ' (inactive)'}
            </Text>
            <View style={s.rowActions}>
              {item.is_active && (
                <TouchableOpacity style={s.deactBtn} onPress={() => onDeactivate(item)}>
                  <Text style={s.deactBtnText}>Deactivate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.delBtn} onPress={() => onDelete(item)}>
                <Ionicons name="trash-outline" size={14} color={COLORS.red} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ManageStatusesScreen() {
  const { role, loading: sessionLoading, canManageStatuses } = useCrmSession();
  const [statusOptions, setStatusOptions] = useState<LeadOption[]>([]);
  const [reasonOptions, setReasonOptions] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [newReason, setNewReason] = useState('');
  const [addingStatus, setAddingStatus] = useState(false);
  const [addingReason, setAddingReason] = useState(false);

  const loadOptions = useCallback(async () => {
    const [statuses, reasons] = await Promise.all([
      fetchAllStatusOptions(),
      fetchAllReasonOptions(),
    ]);
    setStatusOptions(statuses);
    setReasonOptions(reasons);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionLoading && !canManageStatuses) {
      router.replace('/(tabs)/leads');
    }
  }, [sessionLoading, canManageStatuses]);

  useEffect(() => {
    if (canManageStatuses) loadOptions();
  }, [canManageStatuses, loadOptions]);

  async function handleAddStatus() {
    setAddingStatus(true);
    try {
      await addStatusOption(newStatus, role);
      setNewStatus('');
      await loadOptions();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setAddingStatus(false);
  }

  async function handleAddReason() {
    setAddingReason(true);
    try {
      await addReasonOption(newReason, role);
      setNewReason('');
      await loadOptions();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setAddingReason(false);
  }

  function confirmDeactivate(item: LeadOption, type: 'status' | 'reason') {
    Alert.alert(
      'Deactivate option',
      `Deactivate "${item.name}"? Existing leads will keep this value.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'status') await deactivateStatusOption(item.id, role);
              else await deactivateReasonOption(item.id, role);
              await loadOptions();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  }

  function confirmDelete(item: LeadOption, type: 'status' | 'reason') {
    const archiveWarning = type === 'status' && isArchiveLeadStatus(item.name)
      ? '\n\nThis is an archive status. Deleting it removes the archive action for agents.'
      : '';

    Alert.alert(
      'Delete permanently',
      `Permanently delete "${item.name}"? This cannot be undone.${archiveWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'status') await deleteStatusOption(item.id, role, item.name);
              else await deleteReasonOption(item.id, role);
              await loadOptions();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  }

  if (sessionLoading || loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  if (!canManageStatuses) return null;

  return (
    <View style={s.container}>
      <SafeScreenHeader title="Manage Statuses" onBack={() => router.back()} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.columns}>
          <OptionList
            title="Lead Statuses"
            items={statusOptions}
            newName={newStatus}
            onChangeName={setNewStatus}
            onAdd={handleAddStatus}
            onDeactivate={item => confirmDeactivate(item, 'status')}
            onDelete={item => confirmDelete(item, 'status')}
            adding={addingStatus}
          />
          <OptionList
            title="Status Reasons"
            items={reasonOptions}
            newName={newReason}
            onChangeName={setNewReason}
            onAdd={handleAddReason}
            onDeactivate={item => confirmDeactivate(item, 'reason')}
            onDelete={item => confirmDelete(item, 'reason')}
            adding={addingReason}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 14 },
  columns: { flexDirection: 'row', gap: 10 },
  listPanel: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    minHeight: 400,
  },
  panelTitle: { fontSize: 13, fontWeight: '800', color: COLORS.red, marginBottom: 10 },
  addRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  addInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
  },
  addBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  listScroll: { maxHeight: 500 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 4,
  },
  rowInactive: { opacity: 0.45 },
  rowName: { flex: 1, fontSize: 11, fontWeight: '600', color: COLORS.text },
  rowNameInactive: { color: COLORS.muted },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deactBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deactBtnText: { fontSize: 9, fontWeight: '600', color: COLORS.muted },
  delBtn: { padding: 4 },
});
