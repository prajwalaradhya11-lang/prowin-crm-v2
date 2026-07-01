import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle, Card, SectionHeader, Avatar } from '../../components/ui';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

const PERIODS = ['Today', 'This Week', 'This Month', 'Last Month'];

export default function ReportsScreen() {
  const [period, setPeriod] = useState('This Month');
  const [stats, setStats] = useState({ leads: 0, closed: 0, calls: 0, meetings: 0 });
  const [bySource, setBySource] = useState<{ source: string; count: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [topAgents, setTopAgents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  function getRange(p: string): [string, string] {
    const now = new Date();
    if (p === 'Today') return [startOfDay(now).toISOString(), endOfDay(now).toISOString()];
    if (p === 'This Week') return [startOfWeek(now).toISOString(), endOfWeek(now).toISOString()];
    if (p === 'Last Month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return [startOfMonth(lm).toISOString(), endOfMonth(lm).toISOString()];
    }
    return [startOfMonth(now).toISOString(), endOfMonth(now).toISOString()];
  }

  async function fetchReports() {
    const [from, to] = getRange(period);

    const [leadsRes, callsRes, closedRes, agentsRes] = await Promise.all([
      supabase.from('leads').select('id, status, source, agent_name').gte('created_at', from).lte('created_at', to),
      supabase.from('call_logs').select('id').gte('created_at', from).lte('created_at', to),
      supabase.from('leads').select('id, agent_name').eq('status', 'Won').gte('created_at', from).lte('created_at', to),
      supabase.from('leads').select('agent_name').gte('created_at', from).lte('created_at', to),
    ]);

    const leads = leadsRes.data ?? [];
    setStats({
      leads: leads.length,
      closed: closedRes.data?.length ?? 0,
      calls: callsRes.data?.length ?? 0,
      meetings: 0,
    });

    // By source
    const srcMap: Record<string, number> = {};
    leads.forEach((l: any) => { srcMap[l.source ?? 'Unknown'] = (srcMap[l.source ?? 'Unknown'] ?? 0) + 1; });
    setBySource(Object.entries(srcMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count));

    // By status
    const stMap: Record<string, number> = {};
    leads.forEach((l: any) => { stMap[l.status ?? 'New'] = (stMap[l.status ?? 'New'] ?? 0) + 1; });
    setByStatus(Object.entries(stMap).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count));

    // Top agents
    const agentMap: Record<string, number> = {};
    (agentsRes.data ?? []).forEach((l: any) => {
      if (l.agent_name) agentMap[l.agent_name] = (agentMap[l.agent_name] ?? 0) + 1;
    });
    setTopAgents(Object.entries(agentMap).map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads).slice(0, 5));
  }

  useEffect(() => { fetchReports(); }, [period]);
  const onRefresh = async () => { setRefreshing(true); await fetchReports(); setRefreshing(false); };

  const conversion = stats.leads > 0 ? ((stats.closed / stats.leads) * 100).toFixed(1) + '%' : '0%';
  const maxSrc = Math.max(...bySource.map(b => b.count), 1);
  const maxSt = Math.max(...byStatus.map(b => b.count), 1);

  const STATUS_COLORS_MAP: Record<string, string> = {
    Hot: COLORS.red, Warm: COLORS.amber, New: COLORS.blue,
    Won: COLORS.green, Lost: COLORS.muted, Cold: COLORS.muted,
  };

  return (
    <View style={s.container}>
      <ProwinHeader />
      <PageTitle label="CRM overview" title="Reports" />

      {/* Period tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodScroll} contentContainerStyle={s.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p} style={[s.pTab, period === p && s.pTabOn]} onPress={() => setPeriod(p)}>
            <Text style={[s.pTabText, period === p && s.pTabTextOn]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
      >
        {/* Live row */}
        <View style={s.liveRow}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>Live · {format(new Date(), 'd MMM yyyy · HH:mm')}</Text>
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>TOTAL LEADS</Text>
            <Text style={s.statVal}>{stats.leads}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>DEALS CLOSED</Text>
            <Text style={s.statVal}>{stats.closed}</Text>
          </View>
        </View>
        <View style={[s.statsGrid, { marginTop: 8, marginBottom: 12 }]}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>CONVERSION</Text>
            <Text style={s.statVal}>{conversion}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>CALLS MADE</Text>
            <Text style={s.statVal}>{stats.calls}</Text>
          </View>
        </View>

        {/* Leads by source */}
        <Card>
          <Text style={s.chartTitle}>LEADS BY SOURCE</Text>
          {bySource.length === 0 && <Text style={s.noData}>No data for this period</Text>}
          {bySource.map(({ source, count }) => (
            <View key={source} style={s.barRow}>
              <Text style={s.barLabel}>{source}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(count / maxSrc) * 100}%`, backgroundColor: COLORS.red }]} />
              </View>
              <Text style={s.barVal}>{count}</Text>
            </View>
          ))}
        </Card>

        {/* Leads by status */}
        <Card>
          <Text style={s.chartTitle}>LEADS BY STATUS</Text>
          {byStatus.length === 0 && <Text style={s.noData}>No data for this period</Text>}
          {byStatus.map(({ status, count }) => (
            <View key={status} style={s.barRow}>
              <Text style={s.barLabel}>{status}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(count / maxSt) * 100}%`, backgroundColor: STATUS_COLORS_MAP[status] ?? COLORS.muted }]} />
              </View>
              <Text style={s.barVal}>{count}</Text>
            </View>
          ))}
        </Card>

        {/* Top agents */}
        {topAgents.length > 0 && (
          <Card>
            <Text style={s.chartTitle}>TOP AGENTS</Text>
            {topAgents.map((agent, i) => (
              <View key={agent.name} style={[s.agentRow, i < topAgents.length - 1 && s.agentBorder]}>
                <Text style={s.rankNum}>{i + 1}</Text>
                <Avatar
                  initials={agent.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                  color={i === 0 ? COLORS.red : COLORS.blue}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.agentName}>{agent.name}</Text>
                  <Text style={s.agentMeta}>{agent.leads} leads</Text>
                </View>
                {i === 0 && (
                  <View style={s.topBadge}>
                    <Text style={s.topBadgeText}>Top agent</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  periodScroll: { flexGrow: 0, marginTop: 10 },
  periodRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 4 },
  pTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pTabOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  pTabText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  pTabTextOn: { color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 14 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green },
  liveText: { fontSize: 11, color: COLORS.muted },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3, borderTopColor: COLORS.red },
  statLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6 },
  statVal: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  chartTitle: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6, marginBottom: 12 },
  noData: { fontSize: 13, color: COLORS.muted, paddingVertical: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { fontSize: 11, color: COLORS.muted, width: 64, textAlign: 'right' },
  barTrack: { flex: 1, height: 18, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  barVal: { fontSize: 11, fontWeight: '700', color: COLORS.text, width: 24 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  agentBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankNum: { fontSize: 18, fontWeight: '800', color: COLORS.red, width: 22 },
  agentName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  agentMeta: { fontSize: 11, color: COLORS.muted },
  topBadge: { backgroundColor: COLORS.redLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.redBorder },
  topBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.red },
});
