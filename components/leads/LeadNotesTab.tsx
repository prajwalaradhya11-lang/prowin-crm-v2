import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';
import { groupNotesByDate, type NoteItem } from '../../lib/leadNotes';

type LeadNotesTabProps = {
  notes: NoteItem[];
  onAddNote: () => void;
};

export function LeadNotesTab({ notes, onAddNote }: LeadNotesTabProps) {
  const groups = groupNotesByDate(notes);

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <Text style={s.count}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={s.addLink} onPress={onAddNote}>
          <Text style={s.addLinkText}>Add note</Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="document-text-outline" size={40} color={THEME.border} />
          <Text style={s.emptyText}>No notes yet</Text>
        </View>
      ) : (
        groups.map(group => (
          <View key={group.label} style={s.group}>
            <Text style={s.groupLabel}>{group.label}</Text>
            {group.items.map(note => (
              <View key={note.id} style={s.noteCard}>
                <Text style={s.noteText}>{note.text}</Text>
                <Text style={s.noteMeta}>{note.author} · {note.timeLabel}</Text>
              </View>
            ))}
          </View>
        ))
      )}

      <TouchableOpacity style={s.fab} onPress={onAddNote} accessibilityLabel="Add note">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 80, gap: 10 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: { fontSize: 13, fontWeight: '800', color: THEME.heading },
  addLink: { paddingVertical: 4, paddingHorizontal: 8 },
  addLinkText: { fontSize: 13, fontWeight: '700', color: THEME.red },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { fontSize: 14, color: THEME.meta },
  group: { gap: 8 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.meta,
    textTransform: 'uppercase',
  },
  noteCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    borderLeftWidth: 3,
    borderLeftColor: THEME.red,
    padding: 12,
  },
  noteText: { fontSize: 14, fontWeight: '600', color: THEME.heading, lineHeight: 20 },
  noteMeta: { fontSize: 11, color: THEME.meta, marginTop: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.red,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
