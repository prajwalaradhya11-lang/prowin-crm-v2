import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle, Card, Avatar } from '../../components/ui';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useCrmSession, type CrmUser } from '../../hooks/useCrmSession';
import {
  EMPTY_RECRUITMENT_CALLING_REPORT,
  EMPTY_RECRUITMENT_REPORT,
  RECRUITMENT_CALLING_REPORT_PERIODS,
  RECRUITMENT_REPORT_PERIODS,
  fetchRecruitmentCallingReport,
  fetchRecruitmentReport,
  formatTalkTimeShort,
  type RecruitmentCallingReportResult,
  type RecruitmentCallerRow,
  type RecruitmentReportPeriod,
  type RecruitmentReportResult,
} from '../../lib/recruitmentReports';

const PERIODS = ['Today', 'This Week', 'This Month', 'Last Month'];

const PIPELINE_COLORS: Record<string, string> = {
  New: '#0284c7',
  Contacted: '#4f46e5',
  Interview: '#7c3aed',
  Shortlisted: COLORS.amber,
  Hired: COLORS.green,
  Rejected: COLORS.red,
};

function AgentReportsView() {
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

function formatInterviewDate(value: string): string {
  try {
    const parsed = parseISO(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'EEE d MMM yyyy');
  } catch {
    return value;
  }
}

function periodLabel(period: RecruitmentReportPeriod): string {
  return period === 'All Time' ? 'All' : period;
}

function CallingRecruiterCard({
  row,
  resultColumns,
}: {
  row: RecruitmentCallerRow;
  resultColumns: readonly string[];
}) {
  return (
    <View style={s.callerCard}>
      <View style={s.callerTop}>
        <Text style={s.agentName} numberOfLines={1}>
          {row.recruiterName}
        </Text>
        <Text style={s.callerTalk}>{formatTalkTimeShort(row.talkTimeSeconds)}</Text>
      </View>
      <Text style={s.callerCalls}>{row.calls} call{row.calls === 1 ? '' : 's'}</Text>
      <View style={s.resultWrap}>
        {resultColumns.map((result) => {
          const count = row.byResult[result] ?? 0;
          if (count <= 0) return null;
          return (
            <View key={result} style={s.resultChip}>
              <Text style={s.resultChipText}>
                {result}: {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RecruitmentReportsView({
  user,
  role,
}: {
  user: CrmUser | null;
  role: string | null;
}) {
  type ReportView = 'overview' | 'calling';
  const [view, setView] = useState<ReportView>('overview');
  const [period, setPeriod] = useState<RecruitmentReportPeriod>('This Month');
  const [data, setData] = useState<RecruitmentReportResult>(EMPTY_RECRUITMENT_REPORT);
  const [callingData, setCallingData] = useState<RecruitmentCallingReportResult>(
    EMPTY_RECRUITMENT_CALLING_REPORT,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const periodOptions =
    view === 'calling' ? RECRUITMENT_CALLING_REPORT_PERIODS : RECRUITMENT_REPORT_PERIODS;

  const load = useCallback(async () => {
    if (view === 'calling') {
      const next = await fetchRecruitmentCallingReport(user, role, period);
      setCallingData(next);
      return;
    }
    const next = await fetchRecruitmentReport(user, role, period);
    setData(next);
  }, [user, role, period, view]);

  useEffect(() => {
    if (view === 'overview' && period === 'Today') {
      setPeriod('This Month');
    }
  }, [view, period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const maxCalls = Math.max(...data.callsByResult.map((r) => r.count), 1);
  const maxPipeline = Math.max(...data.pipelineByStatus.map((r) => r.count), 1);
  const showEmployees = role !== 'recruiter' && data.employees != null;

  return (
    <View style={s.container}>
      <ProwinHeader />
      <PageTitle label="Recruitment" title="Reports" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.periodScroll}
        contentContainerStyle={s.periodRow}
      >
        {(
          [
            { id: 'overview' as const, label: 'Overview' },
            { id: 'calling' as const, label: 'Calling' },
          ] as const
        ).map((option) => {
          const active = view === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[s.viewTab, active && s.viewTabOn]}
              onPress={() => setView(option.id)}
            >
              <Text style={[s.viewTabText, active && s.viewTabTextOn]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.periodScrollTight}
        contentContainerStyle={s.periodRow}
      >
        {periodOptions.map((p) => (
          <TouchableOpacity key={p} style={[s.pTab, period === p && s.pTabOn]} onPress={() => setPeriod(p)}>
            <Text style={[s.pTabText, period === p && s.pTabTextOn]}>{periodLabel(p)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.red} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
        >
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Live · {format(new Date(), 'd MMM yyyy · HH:mm')}</Text>
          </View>

          {view === 'calling' ? (
            callingData.totalCalls === 0 || callingData.rows.length === 0 ? (
              <Card>
                <View style={s.emptyCalling}>
                  <Ionicons name="call-outline" size={22} color={COLORS.muted} />
                  <Text style={s.emptyCallingTitle}>No calls in this period</Text>
                  <Text style={s.emptyCallingBody}>
                    Logged recruitment calls will show here once recruiters start dialing candidates.
                  </Text>
                </View>
              </Card>
            ) : (
              <>
                <View style={[s.statsGrid, { marginBottom: 12 }]}>
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>TOTAL CALLS</Text>
                    <Text style={s.statVal}>{callingData.totalCalls}</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>TALK TIME</Text>
                    <Text style={s.statVal}>{formatTalkTimeShort(callingData.talkTimeSeconds)}</Text>
                  </View>
                </View>

                <Card>
                  <Text style={s.chartTitle}>CALLING BY RECRUITER</Text>
                  {callingData.rows.map((row, index) => (
                    <View
                      key={row.recruiterId}
                      style={index < callingData.rows.length - 1 ? s.callerCardBorder : undefined}
                    >
                      <CallingRecruiterCard row={row} resultColumns={callingData.resultColumns} />
                    </View>
                  ))}
                </Card>
              </>
            )
          ) : (
            <>
              <View style={s.statsGrid}>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>CALLS</Text>
                  <Text style={s.statVal}>{data.callsInPeriod}</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>TALK TIME</Text>
                  <Text style={s.statVal}>{formatTalkTimeShort(data.talkTimeSeconds)}</Text>
                </View>
              </View>
              <View style={[s.statsGrid, { marginTop: 8, marginBottom: 12 }]}>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>CANDIDATES ADDED</Text>
                  <Text style={s.statVal}>{data.candidatesAddedInPeriod}</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>AT INTERVIEW</Text>
                  <Text style={s.statVal}>{data.atInterviewCount}</Text>
                </View>
              </View>

              <Card>
                <Text style={s.chartTitle}>CALLS BY RESULT</Text>
                {data.callsByResult.length === 0 && <Text style={s.noData}>No calls in this period</Text>}
                {data.callsByResult.map(({ result, count }) => (
                  <View key={result} style={s.barRow}>
                    <Text style={s.barLabelWide} numberOfLines={1}>
                      {result}
                    </Text>
                    <View style={s.barTrack}>
                      <View
                        style={[s.barFill, { width: `${(count / maxCalls) * 100}%`, backgroundColor: COLORS.blue }]}
                      />
                    </View>
                    <Text style={s.barVal}>{count}</Text>
                  </View>
                ))}
              </Card>

              <Card>
                <Text style={s.chartTitle}>PIPELINE (NOW)</Text>
                {data.pipelineByStatus.every((row) => row.count === 0) && (
                  <Text style={s.noData}>No candidates yet</Text>
                )}
                {data.pipelineByStatus.map(({ status, count }) => (
                  <View key={status} style={s.barRow}>
                    <Text style={s.barLabelWide} numberOfLines={1}>
                      {status}
                    </Text>
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${(count / maxPipeline) * 100}%`,
                            backgroundColor: PIPELINE_COLORS[status] ?? COLORS.muted,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.barVal}>{count}</Text>
                  </View>
                ))}
              </Card>

              <Card>
                <Text style={s.chartTitle}>UPCOMING INTERVIEWS</Text>
                {data.upcomingInterviews.length === 0 && (
                  <Text style={s.noData}>No upcoming interviews</Text>
                )}
                {data.upcomingInterviews.map((item, index) => (
                  <View
                    key={`${item.candidate_name}-${item.interview_date}-${index}`}
                    style={[s.interviewRow, index < data.upcomingInterviews.length - 1 && s.agentBorder]}
                  >
                    <Ionicons name="calendar-outline" size={16} color={COLORS.blue} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.agentName}>{item.candidate_name}</Text>
                      <Text style={s.agentMeta}>{formatInterviewDate(item.interview_date)}</Text>
                    </View>
                  </View>
                ))}
              </Card>

              {showEmployees && data.employees && (
                <Card>
                  <Text style={s.chartTitle}>EMPLOYEES</Text>
                  <View style={s.statsGrid}>
                    <View style={s.miniStat}>
                      <Text style={s.statLabel}>TOTAL</Text>
                      <Text style={s.miniStatVal}>{data.employees.total}</Text>
                    </View>
                    <View style={s.miniStat}>
                      <Text style={s.statLabel}>ACTIVE</Text>
                      <Text style={[s.miniStatVal, { color: COLORS.green }]}>{data.employees.active}</Text>
                    </View>
                    <View style={s.miniStat}>
                      <Text style={s.statLabel}>TERMINATED</Text>
                      <Text style={[s.miniStatVal, { color: COLORS.muted }]}>{data.employees.terminated}</Text>
                    </View>
                  </View>
                </Card>
              )}
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

export default function ReportsScreen() {
  const { user, role, loading } = useCrmSession();

  if (loading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  const isHrRole = role === 'hr_manager' || role === 'recruiter';

  if (isHrRole) {
    return <RecruitmentReportsView user={user} role={role} />;
  }

  return <AgentReportsView />;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  periodScroll: { flexGrow: 0, marginTop: 10 },
  periodScrollTight: { flexGrow: 0, marginTop: 6 },
  periodRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 4 },
  viewTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  viewTabOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  viewTabText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  viewTabTextOn: { color: '#fff' },
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
  emptyCalling: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 },
  emptyCallingTitle: { marginTop: 10, fontSize: 14, fontWeight: '700', color: COLORS.text },
  emptyCallingBody: { marginTop: 6, fontSize: 12, color: COLORS.muted, textAlign: 'center', lineHeight: 17 },
  callerCard: { paddingVertical: 10 },
  callerCardBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  callerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  callerTalk: { fontSize: 12, fontWeight: '700', color: COLORS.blue },
  callerCalls: { marginTop: 2, fontSize: 12, fontWeight: '600', color: COLORS.muted },
  resultWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  resultChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultChipText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { fontSize: 11, color: COLORS.muted, width: 64, textAlign: 'right' },
  barLabelWide: { fontSize: 11, color: COLORS.muted, width: 88, textAlign: 'right' },
  barTrack: { flex: 1, height: 18, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  barVal: { fontSize: 11, fontWeight: '700', color: COLORS.text, width: 24 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  interviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  agentBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankNum: { fontSize: 18, fontWeight: '800', color: COLORS.red, width: 22 },
  agentName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  agentMeta: { fontSize: 11, color: COLORS.muted },
  topBadge: { backgroundColor: COLORS.redLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.redBorder },
  topBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.red },
  miniStat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  miniStatVal: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 4 },
});
