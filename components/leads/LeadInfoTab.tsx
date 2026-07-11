import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { THEME } from '../../lib/prowinTheme';
import { getFollowUpDisplay } from '../../lib/leadDisplay';
import { getLeadInterest, INTEREST_OPTIONS } from '../../lib/leadFields';
import { LeadCallRecordingsSection } from './LeadCallRecordingsSection';

type LeadInfoTabProps = {
  statusLabel: string;
  assignedToName: string;
  secondaryAgentName?: string | null;
  reassignPendingName?: string | null;
  lead: {
    priority?: string | null;
    follow_up_date?: string | null;
    follow_up_time?: string | null;
  };
  lastNote: string | null;
  noteDraft?: string;
  savingNote?: boolean;
  savingInterest?: boolean;
  onChangeStatus: () => void;
  onScheduleFollowUp: () => void;
  onNoteDraftChange?: (text: string) => void;
  onSaveNote: () => void;
  onMicPress?: () => void;
  onInterestChange: (interest: string) => void;
  onAddSecondaryAgent: () => void;
  onReassignLead: () => void;
};

export function LeadInfoTab({
  statusLabel,
  assignedToName,
  secondaryAgentName,
  reassignPendingName,
  lead,
  lastNote,
  noteDraft = '',
  savingNote,
  savingInterest,
  onChangeStatus,
  onScheduleFollowUp,
  onNoteDraftChange,
  onSaveNote,
  onMicPress,
  onInterestChange,
  onAddSecondaryAgent,
  onReassignLead,
}: LeadInfoTabProps) {
  const followUp = getFollowUpDisplay(lead.follow_up_date, lead.follow_up_time);
  const interest = getLeadInterest(lead);

  let nextLabel = 'Not set';
  if (lead.follow_up_date) {
    try {
      const iso = lead.follow_up_time?.trim()
        ? `${lead.follow_up_date}T${lead.follow_up_time}`
        : lead.follow_up_date;
      nextLabel = format(parseISO(iso), 'EEE d MMM yyyy · h:mm a');
    } catch {
      nextLabel = lead.follow_up_date;
    }
  }

  function handleMic() {
    if (onMicPress) {
      onMicPress();
    } else {
      Alert.alert('Voice note', 'Voice recording will be available in a later update.');
    }
  }

  return (
    <View style={s.wrap}>
      {reassignPendingName ? (
        <View style={s.pendingBanner}>
          <Ionicons name="time-outline" size={16} color={THEME.amber} />
          <Text style={s.pendingText}>
            Re-assign pending approval · Requested to {reassignPendingName} · awaiting manager/admin
          </Text>
        </View>
      ) : null}

      <View style={s.statusCard}>
        <Text style={s.cardLabel}>lead status</Text>
        <View style={s.statusRow}>
          <View style={s.statusLeft}>
            <Ionicons name="call-outline" size={16} color={THEME.red} />
            <Text style={s.statusValue}>{statusLabel}</Text>
          </View>
          <TouchableOpacity style={s.changeBtn} onPress={onChangeStatus}>
            <Text style={s.changeBtnText}>change</Text>
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
        <TouchableOpacity style={s.followRow} onPress={onScheduleFollowUp} activeOpacity={0.85}>
          <Ionicons name="calendar-outline" size={15} color={THEME.red} />
          <Text style={s.followLabel}>
            Next: <Text style={followUp.overdue ? s.overdue : undefined}>{nextLabel}</Text>
          </Text>
        </TouchableOpacity>
        {lastNote ? (
          <Text style={s.lastNote} numberOfLines={3}>"{lastNote}"</Text>
        ) : (
          <Text style={s.lastNoteEmpty}>No notes yet</Text>
        )}
      </View>

      <View style={s.noteCard}>
        <Text style={s.cardLabel}>Add note</Text>
        <View style={s.noteInputRow}>
          <TextInput
            style={s.noteInput}
            placeholder="Type a note..."
            placeholderTextColor={THEME.meta}
            value={noteDraft}
            onChangeText={onNoteDraftChange}
            multiline
          />
          <TouchableOpacity style={s.micBtn} onPress={handleMic}>
            <Ionicons name="mic" size={18} color={THEME.red} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.saveNoteBtn, savingNote && s.btnDisabled]}
          onPress={onSaveNote}
          disabled={savingNote || !noteDraft.trim()}
        >
          {savingNote ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.saveNoteText}>Save note</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={s.tagsCard}>
        <Text style={s.cardLabel}>Client tags</Text>
        <View style={s.tagRow}>
          {INTEREST_OPTIONS.map(tag => {
            const active = interest === tag;
            return (
              <TouchableOpacity
                key={tag}
                style={[s.tagPill, active && s.tagPillActive]}
                onPress={() => onInterestChange(tag)}
                disabled={savingInterest}
              >
                <Text style={[s.tagText, active && s.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={s.agentsCard}>
        <Text style={s.cardLabel}>Assigned agents</Text>
        <View style={s.agentRow}>
          <View style={{ flex: 1 }}>
            <View style={s.primaryBadge}>
              <Text style={s.primaryBadgeText}>Primary</Text>
            </View>
            <Text style={s.agentName}>{assignedToName}</Text>
          </View>
        </View>
        {secondaryAgentName ? (
          <View style={s.secondaryRow}>
            <Text style={s.secondaryLabel}>Secondary</Text>
            <Text style={s.agentName}>{secondaryAgentName}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={s.addSecondaryRow} onPress={onAddSecondaryAgent}>
          <Ionicons name="person-add-outline" size={16} color={THEME.blue} />
          <Text style={s.addSecondaryText}>Add secondary agent</Text>
        </TouchableOpacity>
        <Text style={s.reassignCaption}>Full re-assign needs manager approval</Text>
        <TouchableOpacity style={s.reassignBtn} onPress={onReassignLead}>
          <Text style={s.reassignBtnText}>Re-assign lead</Text>
        </TouchableOpacity>
      </View>

      <LeadCallRecordingsSection />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, gap: 10 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.amberFill,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f5dfa8',
    padding: 12,
  },
  pendingText: { flex: 1, fontSize: 12, fontWeight: '600', color: THEME.amber, lineHeight: 18 },
  statusCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    borderTopWidth: 3,
    borderTopColor: THEME.red,
    padding: 14,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statusValue: { fontSize: 16, fontWeight: '800', color: THEME.red },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.red,
  },
  changeBtnText: { fontSize: 11, fontWeight: '700', color: THEME.red },
  divider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  followLabel: { fontSize: 13, fontWeight: '600', color: THEME.heading, flex: 1 },
  overdue: { color: THEME.red, fontWeight: '800' },
  lastNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: THEME.meta,
    lineHeight: 18,
    marginTop: 2,
  },
  lastNoteEmpty: { fontSize: 12, fontStyle: 'italic', color: THEME.meta, marginTop: 2 },
  noteCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  noteInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
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
  saveNoteBtn: {
    backgroundColor: THEME.red,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveNoteText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  tagsCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  tagRow: { flexDirection: 'row', gap: 8 },
  tagPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
    alignItems: 'center',
  },
  tagPillActive: {
    backgroundColor: THEME.redTintFill,
    borderColor: THEME.redTintBorder,
  },
  tagText: { fontSize: 13, fontWeight: '700', color: THEME.meta },
  tagTextActive: { color: THEME.red },
  agentsCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  agentRow: { marginBottom: 8 },
  primaryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.greenFill,
    borderWidth: 1,
    borderColor: THEME.greenBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  primaryBadgeText: { fontSize: 10, fontWeight: '800', color: THEME.green },
  agentName: { fontSize: 14, fontWeight: '700', color: THEME.heading },
  secondaryRow: { marginBottom: 8 },
  secondaryLabel: { fontSize: 10, fontWeight: '700', color: THEME.meta, marginBottom: 2 },
  addSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    marginTop: 4,
  },
  addSecondaryText: { fontSize: 13, fontWeight: '700', color: THEME.blue },
  reassignCaption: {
    fontSize: 11,
    color: THEME.meta,
    marginTop: 8,
    marginBottom: 8,
  },
  reassignBtn: {
    borderWidth: 1,
    borderColor: THEME.red,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  reassignBtnText: { fontSize: 13, fontWeight: '700', color: THEME.red },
});
