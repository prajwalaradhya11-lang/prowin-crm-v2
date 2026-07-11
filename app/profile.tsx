import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreenHeader } from '../components/SafeScreenHeader';
import { CrmAvatar } from '../components/CrmAvatar';
import { useCrmSession, getUserDisplayName } from '../hooks/useCrmSession';
import { signOut } from '../lib/auth';
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, loading: sessionLoading } = useCrmSession();
  const [profile, setProfile] = useState<CrmUserProfile | null>(null);
  const [stats, setStats] = useState<AgentMtdStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setStats(null);
      setLoading(false);
      return;
    }
    try {
      const result = await fetchAgentMtdStatsForProfile(user);
      setProfile(result.profile);
      setStats(result.stats);
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

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={THEME.red} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
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
