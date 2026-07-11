import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';
import { getLeadInitials, getName, type LeadNameFields } from '../../lib/leadName';
import { getLeadInterest } from '../../lib/leadFields';
import {
  getFollowUpDisplay,
  getInterestPillStyle,
  getLeadSourceIconConfig,
  getLeadSourceRaw,
  getStatusAccentColor,
} from '../../lib/leadDisplay';

type LeadCompactCardProps = {
  lead: LeadNameFields & {
    id: string;
    phone?: string | null;
    lead_status?: string | null;
    status?: string | null;
    assigned_agent_name?: string | null;
    follow_up_date?: string | null;
    follow_up_time?: string | null;
    lead_source?: string | null;
    source?: string | null;
    sub_source?: string | null;
    priority?: string | null;
  };
  statusLabel: string;
  onPress: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
};

export function LeadCompactCard({
  lead,
  statusLabel,
  onPress,
  onCall,
  onWhatsApp,
}: LeadCompactCardProps) {
  const displayName = getName(lead);
  const initials = getLeadInitials(lead) ?? '?';
  const interest = getLeadInterest(lead);
  const interestStyle = getInterestPillStyle(interest);
  const sourceRaw = getLeadSourceRaw(lead);
  const sourceIcon = getLeadSourceIconConfig(sourceRaw);
  const accent = getStatusAccentColor(statusLabel);
  const followUp = getFollowUpDisplay(lead.follow_up_date, lead.follow_up_time);
  const agentName = lead.assigned_agent_name?.trim() || 'Unassigned';

  return (
    <View style={[s.card, { borderLeftColor: accent }]}>
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && s.pressed]}>
        <View style={s.row1}>
          <View style={[s.avatar, { backgroundColor: `${accent}18` }]}>
            <Text style={[s.avatarText, { color: accent }]}>{initials}</Text>
          </View>
          <View style={s.nameBlock}>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            {lead.phone ? (
              <Text style={s.phone} numberOfLines={1}>{lead.phone}</Text>
            ) : null}
          </View>
          <View style={[s.sourceIconWrap, { backgroundColor: sourceIcon.bg }]}>
            <Ionicons name={sourceIcon.name} size={14} color={sourceIcon.color} />
          </View>
        </View>

        <View style={s.row2}>
          <View style={s.pillRow}>
            <View style={[s.pill, { backgroundColor: `${accent}14`, borderColor: `${accent}40` }]}>
              <Text style={[s.pillText, { color: accent }]} numberOfLines={1}>{statusLabel}</Text>
            </View>
            <View style={[s.pill, { backgroundColor: interestStyle.bg, borderColor: interestStyle.border }]}>
              <Text style={[s.pillText, { color: interestStyle.text }]}>{interest}</Text>
            </View>
          </View>
          <Text style={s.agent} numberOfLines={1}>{agentName}</Text>
        </View>
      </Pressable>

      <View style={s.row3}>
        <Pressable onPress={onPress} style={s.followUpTap}>
          {followUp.overdue && (
            <Ionicons name="alert-circle" size={13} color={THEME.red} style={s.overdueIcon} />
          )}
          <Text
            style={[s.followUp, followUp.overdue && s.followUpOverdue]}
            numberOfLines={1}
          >
            {followUp.overdue ? followUp.label : followUp.label === 'No follow-up' ? followUp.label : `Next: ${followUp.label}`}
          </Text>
        </Pressable>
        <View style={s.quickActions}>
          <TouchableOpacity
            style={s.quickBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onCall();
            }}
            accessibilityLabel="Call lead"
          >
            <Ionicons name="call" size={20} color={THEME.green} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.quickBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onWhatsApp();
            }}
            accessibilityLabel="WhatsApp lead"
          >
            <Ionicons name="logo-whatsapp" size={20} color={THEME.green} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: THEME.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: THEME.border,
    borderLeftWidth: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '800' },
  nameBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '800', color: THEME.heading },
  phone: { fontSize: 12, fontWeight: '600', color: THEME.red, marginTop: 1 },
  sourceIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, minWidth: 0 },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '48%',
  },
  pillText: { fontSize: 10, fontWeight: '700' },
  agent: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.meta,
    maxWidth: '38%',
    textAlign: 'right',
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  followUpTap: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  overdueIcon: { marginRight: 4 },
  followUp: { fontSize: 11, fontWeight: '600', color: THEME.meta, flex: 1 },
  followUpOverdue: { color: THEME.red, fontWeight: '700' },
  quickActions: { flexDirection: 'row', gap: 6 },
  quickBtn: {
    minWidth: 44,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: THEME.greenFill,
    borderWidth: 1,
    borderColor: THEME.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
