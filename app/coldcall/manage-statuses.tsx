import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../lib/supabase';
import { useCrmSession } from '../../hooks/useCrmSession';
import {
  CallStatusOption,
  fetchAllCallStatusOptions,
  addCallStatusOption,
  deactivateCallStatusOption,
} from '../../lib/callStatusOptions';

export default function ManageCallStatusesScreen() {
  const { role, loading: sessionLoading, canManageCallStatuses } = useCrmSession();
  const [options, setOptions] = useState<CallStatusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadOptions = useCallback(async () => {
    const data = await fetchAllCallStatusOptions();
    setOptions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionLoading && !canManageCallStatuses) {
      router.replace('/(tabs)/coldcalling');
    }
  }, [sessionLoading, canManageCallStatuses]);

  useEffect(() => {
    if (canManageCallStatuses) loadOptions();
  }, [canManageCallStatuses, loadOptions]);

  async function handleAdd() {
    setAdding(true);
    try {
      await addCallStatusOption(newName, role);
      setNewName('');
      await loadOptions();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setAdding(false);
  }

  function confirmDeactivate(item: CallStatusOption) {
    Alert.alert(
      'Deactivate status',
      `Deactivate "${item.name}"? Existing contacts will keep this value.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateCallStatusOption(item.id, role);
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

  if (!canManageCallStatuses) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Call Statuses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.panel}>
          <Text style={s.panelTitle}>Call status options</Text>
          <Text style={s.panelHint}>
            Add new statuses or deactivate ones no longer needed. Agents only see active options.
          </Text>

          <View style={s.addRow}>
            <TextInput
              style={s.addInput}
              placeholder="New status name"
              placeholderTextColor={COLORS.muted}
              value={newName}
              onChangeText={setNewName}
            />
            <TouchableOpacity style={s.addBtn} onPress={handleAdd} disabled={adding}>
              {adding
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.addBtnText}>Add</Text>}
            </TouchableOpacity>
          </View>

          {options.map(item => (
            <View key={item.id} style={[s.row, !item.is_active && s.rowInactive]}>
              <Text style={[s.rowName, !item.is_active && s.rowNameInactive]} numberOfLines={2}>
                {item.name}
                {!item.is_active && ' (inactive)'}
              </Text>
              {item.is_active && (
                <TouchableOpacity style={s.deactBtn} onPress={() => confirmDeactivate(item)}>
                  <Text style={s.deactBtnText}>Deactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 52,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 14 },
  panel: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  panelTitle: { fontSize: 14, fontWeight: '800', color: COLORS.red, marginBottom: 6 },
  panelHint: { fontSize: 12, color: COLORS.muted, lineHeight: 18, marginBottom: 14 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  addInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  addBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  rowInactive: { opacity: 0.45 },
  rowName: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  rowNameInactive: { color: COLORS.muted },
  deactBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deactBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.muted },
});
