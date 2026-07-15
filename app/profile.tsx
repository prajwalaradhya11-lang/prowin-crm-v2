import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreenHeader } from '../components/SafeScreenHeader';
import { CrmAvatar } from '../components/CrmAvatar';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
import { useCrmSession, getUserDisplayName, type CrmUser } from '../hooks/useCrmSession';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  fetchAgentMtdStatsForProfile,
  formatTalkTimeHms,
  type AgentMtdStats,
  type CrmUserProfile,
} from '../lib/homeStats';

const THEME = {
  page: '#F4F4F2',
  card: '#FFFFFF',
  border: '#ececec',
  red: '#C0392B',
  blue: '#2563EB',
  green: '#1FA971',
  label: '#999999',
  text: '#1a1a1a',
};

type ProfileLeaveStats = {
  approvedLeaveDays: number;
  lateLoginCount: number;
};

const EMPTY_LEAVE_STATS: ProfileLeaveStats = {
  approvedLeaveDays: 0,
  lateLoginCount: 0,
};

async function fetchProfileLeaveStats(user: CrmUser): Promise<ProfileLeaveStats> {
  try {
    const displayName = getUserDisplayName(user).trim();

    const [leavesRes, attendanceRes] = await Promise.all([
      supabase
        .from('leaves')
        .select('days')
        .eq('employee_id', user.id)
        .eq('status', 'Approved'),
      displayName
        ? supabase
          .from('attendance')
          .select('id')
          .ilike('employee_name', displayName)
          .gt('check_in', '10:00:00')
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (leavesRes.error) {
      console.warn('[profile] leave stats', leavesRes.error.message);
    }
    if (attendanceRes.error) {
      console.warn('[profile] late login stats', attendanceRes.error.message);
    }

    const approvedLeaveDays = (leavesRes.data ?? []).reduce((sum: number, row: { days: number | null }) => {
      const days = Number(row.days);
      return sum + (Number.isFinite(days) ? days : 0);
    }, 0);

    return {
      approvedLeaveDays,
      lateLoginCount: (attendanceRes.data ?? []).length,
    };
  } catch (e) {
    console.warn('[profile] leave stats unexpected', e);
    return EMPTY_LEAVE_STATS;
  }
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, role, loading: sessionLoading } = useCrmSession();
  const [profile, setProfile] = useState<CrmUserProfile | null>(null);
  const [stats, setStats] = useState<AgentMtdStats | null>(null);
  const [leaveStats, setLeaveStats] = useState<ProfileLeaveStats>(EMPTY_LEAVE_STATS);
  const [loading, setLoading] = useState(true);
  const [leaveModal, setLeaveModal] = useState(false);
  const isSuperAdmin = role === 'super_admin';

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setStats(null);
      setLeaveStats(EMPTY_LEAVE_STATS);
      setLoading(false);
      return;
    }
    try {
      const [result, nextLeaveStats] = await Promise.all([
        fetchAgentMtdStatsForProfile(user),
        fetchProfileLeaveStats(user),
      ]);
      setProfile(result.profile);
      setStats(result.stats);
      setLeaveStats(nextLeaveStats);
    } catch (e) {
      console.log('[profile] load error', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!sessionLoading) {
      setLoading(true);
      void loadProfile();
    }
  }, [sessionLoading, loadProfile]);

  async function handleLogout() {
    const { error } = await signOut();
    if (error) {
      Alert.alert('Logout failed', error.message);
      return;
    }
    router.replace('/(auth)/login');
  }

  const displayName = profile?.name ?? (user ? getUserDisplayName(user) : 'Agent');

  if (sessionLoading || loading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator color={THEME.red} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[s.container, s.centered]}>
        <Text style={s.emptyText}>Not signed in</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.link}>Go to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeScreenHeader title="My Profile" onBack={() => router.back()} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.heroCard}>
          <CrmAvatar name={displayName} photoUrl={profile?.photo_url} size={88} color={THEME.red} />
          <Text style={s.name}>{displayName}</Text>
          {profile?.role ? <Text style={s.role}>{profile.role}</Text> : null}
        </View>

        <View style={s.infoCard}>
          <InfoLine icon="mail-outline" label="Email" value={profile?.email ?? user.email} />
          {profile?.phone ? (
            <InfoLine icon="call-outline" label="Phone" value={profile.phone} />
          ) : null}
        </View>

        <Text style={s.sectionTitle}>MY STATS · THIS MONTH</Text>
        <View style={s.infoCard}>
          <StatRow label="Connected calls" value={String(Math.round(stats?.connected ?? 0))} />
          <StatRow label="Talk time" value={formatTalkTimeHms(stats?.talkTimeSeconds ?? 0)} />
          <StatRow label="Prospects" value={String(Math.round(stats?.prospects ?? 0))} />
          <StatRow label="Total leads" value={String(Math.round(stats?.totalLeads ?? 0))} />
          <StatRow label="Meetings" value={String(Math.round(stats?.meetings ?? 0))} />
          <StatRow label="Closings" value={String(Math.round(stats?.closings ?? 0))} />
        </View>

        <Text style={s.sectionTitle}>LEAVE & ATTENDANCE</Text>
        <View style={s.infoCard}>
          <TouchableOpacity style={s.applyLeaveBtn} onPress={() => setLeaveModal(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.applyLeaveText}>Apply Leave</Text>
          </TouchableOpacity>
          <StatRow
            label="Approved leave (days)"
            value={String(Math.round(leaveStats.approvedLeaveDays))}
          />
          <StatRow
            label="Late logins (est.)"
            value={String(Math.round(leaveStats.lateLoginCount))}
          />
          <Text style={s.lateCaption}>Estimated from attendance name match</Text>
        </View>

        {isSuperAdmin ? (
          <TouchableOpacity
            style={s.aiBtn}
            onPress={() => router.push('/ai-assistant')}
            accessibilityLabel="Open AI Assistant"
          >
            <Ionicons name="sparkles-outline" size={18} color={THEME.red} />
            <Text style={s.aiBtnText}>AI Assistant</Text>
            <Ionicons name="chevron-forward" size={16} color={THEME.red} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={THEME.red} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <LeaveRequestModal
        visible={leaveModal}
        user={user}
        onClose={() => setLeaveModal(false)}
        onSubmitted={async () => {
          if (user) setLeaveStats(await fetchProfileLeaveStats(user));
        }}
      />
    </View>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={s.infoLine}>
      <Ionicons name={icon} size={16} color={THEME.label} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.page },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 32 },
  heroCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: THEME.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: '800', color: THEME.text, marginTop: 12 },
  role: { fontSize: 13, color: THEME.label, marginTop: 4, textTransform: 'capitalize' },
  infoCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: THEME.border,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: THEME.label, letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: THEME.text, marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.label,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: { fontSize: 13, color: THEME.label, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '700', color: THEME.text },
  applyLeaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.red,
    borderRadius: 12,
    paddingVertical: 12,
  },
  applyLeaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lateCaption: { fontSize: 11, color: THEME.label, marginTop: -4 },
  aiBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: '#f5d0cc',
    backgroundColor: '#fdf2f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  aiBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: THEME.red },
  logoutBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: THEME.red },
  emptyText: { fontSize: 15, color: THEME.label },
  link: { marginTop: 12, fontSize: 14, fontWeight: '700', color: THEME.red },
});
