import React from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, STATUS_COLORS } from '../lib/supabase';
import { getLeadInitials, type LeadNameFields } from '../lib/leadName';
import { getContactInitials, type ContactNameFields } from '../lib/contactName';
import { CrmAvatar } from './CrmAvatar';

// ─── PROWIN HEADER ──────────────────────────────────────────────────────────
export function ProwinHeader({
  subtitle,
  rightContent,
  onBell,
  onAvatarPress,
  onLogoPress,
  unreadCount = 0,
  agentInitials = 'PA',
  agentName,
  agentPhotoUrl,
}: {
  subtitle?: string;
  /** Extra controls shown before the bell (e.g. add button). Bell + avatar always visible. */
  rightContent?: React.ReactNode;
  onBell?: () => void;
  onAvatarPress?: () => void;
  onLogoPress?: () => void;
  unreadCount?: number;
  agentInitials?: string;
  agentName?: string;
  agentPhotoUrl?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const displayName = agentName?.trim() || agentInitials;

  function handleLogoPress() {
    if (onLogoPress) {
      onLogoPress();
    } else {
      router.push('/(tabs)/');
    }
  }

  function handleBell() {
    if (onBell) {
      onBell();
    } else {
      router.push('/notifications');
    }
  }

  function handleAvatarPress() {
    if (onAvatarPress) {
      onAvatarPress();
      return;
    }
    router.push('/profile');
  }

  return (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={s.logoWrap} onPress={handleLogoPress} accessibilityLabel="Go to home">
        <View style={s.logoBox}>
          <Text style={s.logoP}>P</Text>
        </View>
        <View>
          <Text style={s.brandName}>PROWIN</Text>
          <Text style={s.brandSub}>PROPERTIES</Text>
          {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      <View style={s.headerRight}>
        {rightContent}
        <TouchableOpacity style={s.bellWrap} onPress={handleBell} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={22} color={COLORS.muted} />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={s.avatar} onPress={handleAvatarPress} accessibilityLabel="Agent profile">
          <CrmAvatar
            name={displayName}
            photoUrl={agentPhotoUrl}
            size={32}
            color={COLORS.red}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── PAGE TITLE BAR ─────────────────────────────────────────────────────────
export function PageTitle({ label, title }: { label: string; title: string }) {
  return (
    <View style={s.pageTitle}>
      <Text style={s.pageTitleLabel}>{label}</Text>
      <Text style={s.pageTitleName}>{title}</Text>
    </View>
  );
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS['Cold'];
  return (
    <View style={[s.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[s.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

// ─── AI SUMMARY STRIP ────────────────────────────────────────────────────────
export function AISummary({ text, loading }: { text: string; loading?: boolean }) {
  if (!text && !loading) return null;
  return (
    <View style={s.aiBox}>
      <View style={s.aiHeader}>
        <Ionicons name="sparkles" size={13} color={COLORS.red} />
        <Text style={s.aiLabel}>AI summary</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={COLORS.red} />
        : <Text style={s.aiText}>{text}</Text>}
    </View>
  );
}

// ─── ACTION BUTTON ROW ────────────────────────────────────────────────────────
export function ActionButtons({
  onCall, onWhatsApp, onEmail, onView, emailDisabled,
}: {
  onCall: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onView: () => void;
  emailDisabled?: boolean;
}) {
  return (
    <View style={s.actRow}>
      <TouchableOpacity style={[s.actBtn, s.actCall]} onPress={onCall}>
        <Ionicons name="call-outline" size={14} color={COLORS.green} />
        <Text style={[s.actText, { color: COLORS.green }]}>Call</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.actBtn, s.actWa]} onPress={onWhatsApp}>
        <Ionicons name="logo-whatsapp" size={14} color="#15803d" />
        <Text style={[s.actText, { color: '#15803d' }]}>WhatsApp</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.actBtn, s.actMail, emailDisabled && s.actBtnDisabled]}
        onPress={onEmail}
        disabled={emailDisabled}
      >
        <Ionicons name="mail-outline" size={14} color={COLORS.blue} />
        <Text style={[s.actText, { color: COLORS.blue }]}>Email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.actBtn, s.actView]} onPress={onView}>
        <Ionicons name="eye-outline" size={14} color={COLORS.red} />
        <Text style={[s.actText, { color: COLORS.red }]}>View</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── CARD WRAPPER ─────────────────────────────────────────────────────────────
export function Card({
  children,
  topColor,
  style,
}: {
  children: React.ReactNode;
  topColor?: string;
  style?: object;
}) {
  return (
    <View style={[s.card, topColor ? { borderTopColor: topColor, borderTopWidth: 3 } : {}, style]}>
      {children}
    </View>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
export function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title.toUpperCase()}</Text>;
}

// ─── RED BUTTON ──────────────────────────────────────────────────────────────
export function RedButton({
  label, onPress, icon, loading,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={s.redBtn} onPress={onPress} disabled={loading}>
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <>
            {icon && <Ionicons name={icon as any} size={18} color="#fff" />}
            <Text style={s.redBtnText}>{label}</Text>
          </>}
    </TouchableOpacity>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
export function StatCard({
  label, value, sub, subColor,
}: {
  label: string; value: string; sub?: string; subColor?: string;
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
      <Text style={s.statValue}>{value}</Text>
      {sub && <Text style={[s.statSub, { color: subColor ?? COLORS.muted }]}>{sub}</Text>}
    </View>
  );
}

// ─── AVATAR CIRCLE ───────────────────────────────────────────────────────────
export function Avatar({ initials, color = COLORS.red }: { initials: string; color?: string }) {
  const bg = color + '22'; // 13% opacity
  return (
    <View style={[s.avatarCircle, { backgroundColor: bg }]}>
      <Text style={[s.avatarCircleText, { color }]}>{initials}</Text>
    </View>
  );
}

export function LeadAvatar({ lead, color = COLORS.red }: { lead: LeadNameFields; color?: string }) {
  const initials = getLeadInitials(lead);
  const bg = color + '22';

  if (initials) {
    return (
      <View style={[s.avatarCircle, { backgroundColor: bg }]}>
        <Text style={[s.avatarCircleText, { color }]}>{initials}</Text>
      </View>
    );
  }

  if (lead.phone?.trim()) {
    return (
      <View style={[s.avatarCircle, { backgroundColor: bg }]}>
        <Ionicons name="call-outline" size={18} color={color} />
      </View>
    );
  }

  return (
    <View style={[s.avatarCircle, { backgroundColor: bg }]}>
      <Text style={[s.avatarCircleText, { color }]}>?</Text>
    </View>
  );
}

export function ContactAvatar({ contact, color = COLORS.red }: { contact: ContactNameFields; color?: string }) {
  const initials = getContactInitials(contact);
  const bg = color + '22';

  if (initials) {
    return (
      <View style={[s.avatarCircle, { backgroundColor: bg }]}>
        <Text style={[s.avatarCircleText, { color }]}>{initials}</Text>
      </View>
    );
  }

  if (contact.phone?.trim()) {
    return (
      <View style={[s.avatarCircle, { backgroundColor: bg }]}>
        <Ionicons name="call-outline" size={18} color={color} />
      </View>
    );
  }

  return (
    <View style={[s.avatarCircle, { backgroundColor: bg }]}>
      <Text style={[s.avatarCircleText, { color }]}>?</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
  },
  logoP: { fontSize: 16, fontWeight: '900', color: '#fff' },
  brandName: { fontSize: 13, fontWeight: '800', color: COLORS.red, letterSpacing: 0.5 },
  brandSub: { fontSize: 8, color: COLORS.muted, letterSpacing: 1.5, fontWeight: '500' },
  headerSubtitle: { fontSize: 10, color: COLORS.text, fontWeight: '600', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellWrap: { position: 'relative' },
  bellDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.red,
    position: 'absolute', top: 0, right: 0,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  pageTitle: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pageTitleLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  pageTitleName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  badge: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  aiBox: {
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: COLORS.redBorder,
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  aiLabel: { fontSize: 10, fontWeight: '700', color: COLORS.red },
  aiText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  actRow: { flexDirection: 'row', gap: 6 },
  actBtn: {
    flex: 1, paddingVertical: 8,
    borderRadius: 9, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
  },
  actText: { fontSize: 11, fontWeight: '700' },
  actBtnDisabled: { opacity: 0.45 },
  actCall: { backgroundColor: COLORS.greenLight, borderColor: COLORS.greenBorder },
  actWa: { backgroundColor: COLORS.greenLight, borderColor: COLORS.greenBorder },
  actMail: { backgroundColor: COLORS.blueLight, borderColor: COLORS.blueBorder },
  actView: { backgroundColor: COLORS.redLight, borderColor: COLORS.redBorder },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13, marginBottom: 10,
    borderTopColor: COLORS.red, borderTopWidth: 3,
  },
  sectionHeader: {
    fontSize: 10, fontWeight: '700',
    color: COLORS.muted, letterSpacing: 0.8,
    marginTop: 14, marginBottom: 8,
  },
  redBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  redBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
    borderTopWidth: 3, borderTopColor: COLORS.red,
    flex: 1,
  },
  statLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginVertical: 3 },
  statSub: { fontSize: 11, fontWeight: '600' },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircleText: { fontSize: 14, fontWeight: '700' },
});
