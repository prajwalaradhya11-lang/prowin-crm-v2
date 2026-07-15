import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ProwinHeader, PageTitle } from '../../components/ui';
import { CrmAvatar } from '../../components/CrmAvatar';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';
import {
  fetchHomeDashboardData,
  formatTalkTimeHms,
  getFirstName,
  type ChampionEntry,
  type HomeDashboardData,
} from '../../lib/homeStats';
import { getInitialsFromName } from '../../components/CrmAvatar';

const HOME = {
  page: '#F4F4F2',
  card: '#FFFFFF',
  border: '#ececec',
  red: '#C0392B',
  blue: '#2563EB',
  amber: '#E28A2B',
  green: '#1FA971',
  label: '#999999',
  text: '#1a1a1a',
};

const EMPTY_DATA: HomeDashboardData = {
  profile: null,
  agentStats: {
    connected: 0,
    talkTimeSeconds: 0,
    prospects: 0,
    totalLeads: 0,
    meetings: 0,
    closings: 0,
  },
  pipeline: { newL: 0, hot: 0, warm: 0, won: 0 },
  champions: { revenue: null, talkTime: null, meetings: null },
};

function roundStat(value: number): string {
  return String(Math.round(value));
}

function MetricColumn({
  label,
  value,
  valueColor,
  wide,
  onPress,
}: {
  label: string;
  value: string;
  valueColor?: string;
  wide?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={s.metricLabel}>{label}</Text>
      <Text
        style={[s.metricValue, wide && s.metricValueWide, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable style={[s.metricCol, wide && s.metricColWide]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={[s.metricCol, wide && s.metricColWide]}>{content}</View>;
}

function HomeCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.card, { borderTopColor: accentColor }]}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChampionHero({ entry }: { entry: ChampionEntry }) {
  if (!entry) {
    return (
      <View style={[s.heroCard, { borderTopColor: HOME.amber }]}>
        <Text style={s.heroLabel}>HIGHEST REVENUE</Text>
        <Text style={s.emptyDash}>—</Text>
      </View>
    );
  }

  return (
    <View style={[s.heroCard, { borderTopColor: HOME.amber }]}>
      <View style={s.rankPillWrap}>
        <View style={s.rankPill}>
          <Ionicons name="trophy" size={12} color={HOME.amber} />
          <Text style={s.rankText}>#1</Text>
        </View>
      </View>
      <Text style={s.heroLabel}>HIGHEST REVENUE</Text>
      <CrmAvatar name={entry.name} photoUrl={entry.photo_url} size={70} />
      <Text style={s.heroName}>{entry.name}</Text>
      <Text style={s.heroRole}>{entry.role}</Text>
      <Text style={s.heroValue}>{entry.displayValue}</Text>
    </View>
  );
}

function ChampionMini({
  title,
  accentColor,
  entry,
}: {
  title: string;
  accentColor: string;
  entry: ChampionEntry;
}) {
  return (
    <View style={[s.miniCard, { borderTopColor: accentColor }]}>
      <View style={s.miniHeader}>
        <Text style={s.miniTitle}>{title}</Text>
        {entry ? (
          <View style={s.rankPillSmall}>
            <Text style={s.rankTextSmall}>#1</Text>
          </View>
        ) : null}
      </View>
      {entry ? (
        <>
          <CrmAvatar name={entry.name} photoUrl={entry.photo_url} size={50} />
          <Text style={s.miniName} numberOfLines={1}>{entry.name}</Text>
          <Text style={[s.miniValue, title === 'TALK TIME' && s.talkTimeMini]} numberOfLines={1}>
            {entry.displayValue}
          </Text>
        </>
      ) : (
        <Text style={s.emptyDash}>—</Text>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const { user, role, loading: sessionLoading } = useCrmSession();
  const [data, setData] = useState<HomeDashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isSuperAdmin = role === 'super_admin';

  const displayName = user ? getUserDisplayName(user) : 'Agent';
  const firstName = getFirstName(data.profile?.name ?? displayName);
  const agentInitials = getInitialsFromName(displayName);

  const loadData = useCallback(async () => {
    if (!user) {
      setData(EMPTY_DATA);
      setLoading(false);
      return;
    }
    try {
      setData(await fetchHomeDashboardData(user));
    } catch (e) {
      console.log('[home] load error', e);
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!sessionLoading) {
      setLoading(true);
      void loadData();
    }
  }, [sessionLoading, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const pipeline = data.pipeline;
  const stats = data.agentStats;

  const pipelineLegend = useMemo(
    () => [
      ['New', HOME.blue, pipeline.newL],
      ['Hot', HOME.red, pipeline.hot],
      ['Warm', HOME.amber, pipeline.warm],
      ['Won', HOME.green, pipeline.won],
    ] as const,
    [pipeline],
  );

  if (sessionLoading || loading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator color={HOME.red} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ProwinHeader
        agentInitials={agentInitials}
        agentName={data.profile?.name ?? displayName}
        agentPhotoUrl={data.profile?.photo_url}
      />
      <PageTitle label="CRM overview" title={`${greeting}, ${firstName}`} />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={HOME.red} />
        }
      >
        <View style={s.liveRow}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>Live · {format(new Date(), 'EEE d MMM yyyy · HH:mm')}</Text>
        </View>

        <TouchableOpacity style={s.clockBanner} onPress={() => router.push('/clockin')}>
          <Ionicons name="time-outline" size={20} color={HOME.red} />
          <Text style={s.clockText}>Clock in / Check attendance</Text>
          <Ionicons name="chevron-forward" size={16} color={HOME.red} />
        </TouchableOpacity>

        {isSuperAdmin ? (
          <TouchableOpacity
            style={s.aiBanner}
            onPress={() => router.push('/ai-assistant')}
            accessibilityLabel="Open AI Assistant"
          >
            <Ionicons name="sparkles-outline" size={20} color={HOME.red} />
            <Text style={s.clockText}>AI Assistant</Text>
            <Ionicons name="chevron-forward" size={16} color={HOME.red} />
          </TouchableOpacity>
        ) : null}

        <HomeCard title="CALLS · THIS MONTH" accentColor={HOME.blue}>
          <View style={s.metricsRow}>
            <MetricColumn
              label="CONNECTED"
              value={roundStat(stats.connected)}
              valueColor={HOME.blue}
            />
            <View style={s.metricDivider} />
            <MetricColumn
              label="TALK-TIME"
              value={formatTalkTimeHms(stats.talkTimeSeconds)}
              wide
            />
            <View style={s.metricDivider} />
            <MetricColumn
              label="PROSPECTS"
              value={roundStat(stats.prospects)}
              valueColor={HOME.amber}
            />
          </View>
        </HomeCard>

        <HomeCard title="LEADS · THIS MONTH" accentColor={HOME.red}>
          <View style={s.metricsRow}>
            <MetricColumn
              label="TOTAL LEADS"
              value={roundStat(stats.totalLeads)}
              onPress={() => router.push('/(tabs)/leads')}
            />
            <View style={s.metricDivider} />
            <MetricColumn
              label="MEETINGS"
              value={roundStat(stats.meetings)}
              valueColor={HOME.blue}
              onPress={() => router.push({ pathname: '/(tabs)/leads', params: { status: 'Meeting Scheduled' } })}
            />
            <View style={s.metricDivider} />
            <MetricColumn
              label="CLOSINGS"
              value={roundStat(stats.closings)}
              valueColor={HOME.green}
              onPress={() => router.push({ pathname: '/(tabs)/leads', params: { status: 'Booked' } })}
            />
          </View>
        </HomeCard>

        <HomeCard title="PIPELINE OVERVIEW" accentColor={HOME.amber}>
          <View style={s.pipeBar}>
            <View style={[s.pipeSeg, { flex: pipeline.newL || 1, backgroundColor: HOME.blue }]} />
            <View style={[s.pipeSeg, { flex: pipeline.hot || 1, backgroundColor: HOME.red }]} />
            <View style={[s.pipeSeg, { flex: pipeline.warm || 1, backgroundColor: HOME.amber }]} />
            <View style={[s.pipeSeg, { flex: pipeline.won || 1, backgroundColor: HOME.green }]} />
          </View>
          <View style={s.pipeLegend}>
            {pipelineLegend.map(([label, color, val]) => (
              <View key={label} style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: color }]} />
                <Text style={s.legText}>{label} {val}</Text>
              </View>
            ))}
          </View>
        </HomeCard>

        <View style={s.championsHeader}>
          <Ionicons name="trophy-outline" size={14} color={HOME.amber} />
          <Text style={s.championsTitle}>THIS MONTH'S CHAMPIONS</Text>
        </View>

        <ChampionHero entry={data.champions.revenue} />
        <View style={s.championRow}>
          <ChampionMini title="TALK TIME" accentColor={HOME.blue} entry={data.champions.talkTime} />
          <ChampionMini title="MEETINGS" accentColor={HOME.red} entry={data.champions.meetings} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: HOME.page },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, paddingHorizontal: 14 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: HOME.green },
  liveText: { fontSize: 11, color: HOME.label },
  aiBanner: {
    backgroundColor: '#fdf2f1',
    borderWidth: 0.5,
    borderColor: '#f5d0cc',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  clockBanner: {
    backgroundColor: '#fdf2f1',
    borderWidth: 0.5,
    borderColor: '#f5d0cc',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  clockText: { flex: 1, fontSize: 13, fontWeight: '700', color: HOME.red },
  card: {
    backgroundColor: HOME.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: HOME.border,
    borderTopWidth: 2.5,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: HOME.label,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  metricsRow: { flexDirection: 'row', alignItems: 'stretch' },
  metricCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  metricColWide: { flex: 1.25 },
  metricDivider: { width: 0.5, backgroundColor: HOME.border, marginVertical: 2 },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: HOME.label,
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '500',
    color: HOME.text,
    textAlign: 'center',
  },
  metricValueWide: {
    fontSize: 18,
    fontWeight: '600',
  },
  pipeBar: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  pipeSeg: { borderRadius: 2 },
  pipeLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legText: { fontSize: 11, color: HOME.label },
  championsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  championsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: HOME.label,
    letterSpacing: 0.8,
  },
  heroCard: {
    backgroundColor: HOME.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: HOME.border,
    borderTopWidth: 2.5,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: HOME.label,
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  heroName: { fontSize: 16, fontWeight: '800', color: HOME.text, marginTop: 10 },
  heroRole: { fontSize: 12, color: HOME.label, marginTop: 2, textTransform: 'capitalize' },
  heroValue: { fontSize: 22, fontWeight: '700', color: HOME.green, marginTop: 8 },
  rankPillWrap: { position: 'absolute', top: 12, right: 12 },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3e0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rankText: { fontSize: 11, fontWeight: '800', color: HOME.amber },
  championRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  miniCard: {
    flex: 1,
    backgroundColor: HOME.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: HOME.border,
    borderTopWidth: 2.5,
    padding: 12,
    alignItems: 'center',
    minHeight: 140,
  },
  miniHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  miniTitle: { fontSize: 10, fontWeight: '700', color: HOME.label, letterSpacing: 0.5 },
  rankPillSmall: {
    backgroundColor: '#fef3e0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankTextSmall: { fontSize: 10, fontWeight: '800', color: HOME.amber },
  miniName: { fontSize: 12, fontWeight: '700', color: HOME.text, marginTop: 8, textAlign: 'center' },
  miniValue: { fontSize: 16, fontWeight: '600', color: HOME.text, marginTop: 4 },
  talkTimeMini: { fontSize: 14 },
  emptyDash: { fontSize: 24, fontWeight: '500', color: HOME.label, marginVertical: 16 },
});
