import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';

type LeadCallRecordingsSectionProps = {
  recordings?: Array<{ id: string; label: string; duration?: string; date?: string }>;
};

/** Call recordings list — empty until recording backend is wired. */
export function LeadCallRecordingsSection({ recordings = [] }: LeadCallRecordingsSectionProps) {
  return (
    <View style={s.card}>
      <Text style={s.label}>Call recordings</Text>
      {recordings.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="mic-outline" size={20} color={THEME.meta} />
          <Text style={s.emptyText}>No recordings yet</Text>
        </View>
      ) : (
        recordings.map(rec => (
          <View key={rec.id} style={s.row}>
            <Ionicons name="play-circle-outline" size={18} color={THEME.red} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{rec.label}</Text>
              <Text style={s.rowMeta}>{[rec.duration, rec.date].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyText: { fontSize: 13, color: THEME.meta, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: THEME.heading },
  rowMeta: { fontSize: 11, color: THEME.meta, marginTop: 2 },
});
