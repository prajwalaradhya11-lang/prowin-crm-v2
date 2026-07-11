import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';
import type { AgentOption } from '../../lib/leadAgents';

type AgentPickerSheetProps = {
  visible: boolean;
  title: string;
  agents: AgentOption[];
  loading?: boolean;
  onClose: () => void;
  onSelect: (agent: AgentOption) => void;
};

export function AgentPickerSheet({
  visible,
  title,
  agents,
  loading,
  onClose,
  onSelect,
}: AgentPickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.heading} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={THEME.red} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={agents}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.row} onPress={() => onSelect(item)}>
                  <Ionicons name="person-circle-outline" size={22} color={THEME.meta} />
                  <Text style={s.rowText}>{item.fullName}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={s.empty}>No agents found</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  title: { fontSize: 16, fontWeight: '800', color: THEME.heading },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  rowText: { fontSize: 14, fontWeight: '600', color: THEME.heading },
  empty: { textAlign: 'center', color: THEME.meta, padding: 24 },
});
