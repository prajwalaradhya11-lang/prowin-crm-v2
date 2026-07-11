import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../lib/prowinTheme';
import { getLeadInitials, getName, type LeadNameFields } from '../../lib/leadName';

type LeadDetailHeaderProps = {
  lead: LeadNameFields & {
    phone?: string | null;
    email?: string | null;
  };
  onBack: () => void;
  onEdit: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onSms: () => void;
  onLog: () => void;
};

export function LeadDetailHeader({
  lead,
  onBack,
  onEdit,
  onCall,
  onWhatsApp,
  onSms,
  onLog,
}: LeadDetailHeaderProps) {
  const insets = useSafeAreaInsets();
  const displayName = getName(lead);
  const initials = getLeadInitials(lead) ?? '?';

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={THEME.red} />
        </TouchableOpacity>
        <TouchableOpacity style={s.editPill} onPress={onEdit}>
          <Text style={s.editText}>edit</Text>
        </TouchableOpacity>
      </View>

      <View style={s.identityRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={s.identityText}>
          <Text style={s.name}>{displayName}</Text>
          {lead.phone ? <Text style={s.phone}>{lead.phone}</Text> : null}
          {lead.email ? <Text style={s.email}>{lead.email}</Text> : null}
        </View>
      </View>

      <View style={s.actionRow}>
        <ActionPill label="Call" icon="call" tint="green" onPress={onCall} />
        <ActionPill label="WA" icon="logo-whatsapp" tint="green" onPress={onWhatsApp} />
        <ActionPill label="SMS" icon="chatbubble-outline" tint="blue" onPress={onSms} />
        <ActionPill label="Log" icon="time-outline" tint="red" onPress={onLog} />
      </View>
    </View>
  );
}

function ActionPill({
  label,
  icon,
  tint,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: 'green' | 'blue' | 'red';
  onPress: () => void;
}) {
  const styles = tint === 'green'
    ? { bg: THEME.greenFill, border: THEME.greenBorder, color: THEME.green }
    : tint === 'blue'
      ? { bg: THEME.blueFill, border: '#c5d9f5', color: THEME.blue }
      : { bg: THEME.redTintFill, border: THEME.redTintBorder, color: THEME.red };

  return (
    <TouchableOpacity
      style={[s.actionPill, { backgroundColor: styles.bg, borderColor: styles.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={15} color={styles.color} />
      <Text style={[s.actionLabel, { color: styles.color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  editPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.red,
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.red,
    textTransform: 'lowercase',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.redFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: THEME.red },
  identityText: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '800', color: THEME.heading },
  phone: { fontSize: 13, fontWeight: '600', color: THEME.red, marginTop: 2 },
  email: { fontSize: 12, color: THEME.meta, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 11, fontWeight: '700' },
});
