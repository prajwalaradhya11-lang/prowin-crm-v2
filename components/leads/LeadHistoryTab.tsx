import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';
import {
  groupHistoryByDate,
  formatTimestamp,
  type HistoryEvent,
  type HistoryStats,
} from '../../lib/leadHistory';

type LeadHistoryTabProps = {
  stats: HistoryStats;
  events: HistoryEvent[];
};

function eventIcon(type: HistoryEvent['type']): {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
} {
  switch (type) {
    case 'answered':
      return { name: 'checkmark-circle', color: THEME.green };
    case 'missed':
      return { name: 'close-circle', color: '#d8a49c' };
    case 'follow_up':
      return { name: 'calendar', color: THEME.red };
    case 'note':
      return { name: 'document-text', color: THEME.red };
    default:
      return { name: 'ellipse', color: THEME.meta };
  }
}

export function LeadHistoryTab({ stats, events }: LeadHistoryTabProps) {
  const groups = groupHistoryByDate(events);

  return (
    <View style={s.wrap}>
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statVal}>{stats.calls}</Text>
          <Text style={s.statLabel}>Calls</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statVal}>{stats.talkTimeMinutes}m</Text>
          <Text style={s.statLabel}>Talk-time</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statVal}>{stats.answered}</Text>
          <Text style={s.statLabel}>Answered</Text>
        </View>
      </View>

      {groups.length === 0 ? (
        <Text style={s.empty}>No activity yet</Text>
      ) : (
        groups.map(group => (
          <View key={group.label} style={s.group}>
            <Text style={s.groupLabel}>{group.label}</Text>
            {group.items.map(ev => {
              const icon = eventIcon(ev.type);
              return (
                <View key={ev.id} style={s.eventCard}>
                  <View style={[s.eventDot, { backgroundColor: `${icon.color}22` }]}>
                    <Ionicons name={icon.name} size={14} color={icon.color} />
                  </View>
                  <View style={s.eventBody}>
                    <Text style={s.eventTitle}>{ev.title}</Text>
                    {ev.subtitle ? <Text style={s.eventSub}>{ev.subtitle}</Text> : null}
                    {ev.note ? (
                      <View style={s.noteBubble}>
                        <Text style={s.noteText}>{ev.note}</Text>
                      </View>
                    ) : null}
                    <Text style={s.eventMeta}>
                      {[ev.agentName, formatTimestamp(ev.timestamp)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, gap: 12, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statVal: { fontSize: 18, fontWeight: '800', color: THEME.heading },
  statLabel: { fontSize: 10, fontWeight: '700', color: THEME.meta, marginTop: 2 },
  empty: { textAlign: 'center', color: THEME.meta, paddingVertical: 32 },
  group: { gap: 8 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
  },
  eventDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '800', color: THEME.heading },
  eventSub: { fontSize: 12, color: THEME.meta, marginTop: 2 },
  noteBubble: {
    backgroundColor: THEME.page,
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  noteText: { fontSize: 12, color: THEME.heading, lineHeight: 18 },
  eventMeta: { fontSize: 10, color: THEME.meta, marginTop: 6 },
});
