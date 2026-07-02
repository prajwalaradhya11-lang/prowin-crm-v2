import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import {
  ProwinHeader, PageTitle, StatCard,
  Card, StatusBadge, SectionHeader, LeadAvatar,
} from '../../components/ui';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';
import { formatTaskDue, mapTaskTypeFromDb } from '../../lib/tasks';
import { getName } from '../../lib/leadName';
import { format } from 'date-fns';

export default function DashboardScreen() {
  const { user } = useCrmSession();
  const [stats, setStats] = useState({ totalLeads: 0, openTasks: 0, callsToday: 0, conversion: '0%' });
  const [pipeline, setPipeline] = useState({ hot: 0, warm: 0, newL: 0, won: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const agentName = user ? getUserDisplayName(user).split(' ')[0] : 'Agent';
  const agentInitials = user
    ? getUserDisplayName(user).split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : 'PA';

  async function loadData() {
    const today = format(new Date(), 'yyyy-MM-dd');

    const [leadsRes, tasksRes, callsRes] = await Promise.all([
      supabase.from('leads').select('id, lead_name, first_name, last_name, phone, lead_status, status, property_type, area, budget, ai_summary, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('tasks').select('id, title, due_date, due_time, task_type, status, related_id').gte('due_date', today).order('due_date').limit(5),
      supabase.from('call_logs').select('id').gte('created_at', today + 'T00:00:00').lt('created_at', today + 'T23:59:59'),
    ]);

    if (leadsRes.data) {
      setRecentLeads(leadsRes.data.slice(0, 3));
      const hot = leadsRes.data.filter((l: any) => (l.lead_status ?? l.status) === 'Hot').length;
      const warm = leadsRes.data.filter((l: any) => (l.lead_status ?? l.status) === 'Warm').length;
      const newL = leadsRes.data.filter((l: any) => (l.lead_status ?? l.status) === 'New').length;
      const won = leadsRes.data.filter((l: any) => (l.lead_status ?? l.status) === 'Won').length;
      const total = leadsRes.data.length;
      setPipeline({ hot, warm, newL, won });
      setStats(prev => ({
        ...prev,
        totalLeads: total,
        conversion: total > 0 ? ((won / total) * 100).toFixed(1) + '%' : '0%',
      }));
    }
    if (tasksRes.data) setUpcomingTasks(tasksRes.data);
    if (callsRes.data) {
      setStats(prev => ({ ...prev, callsToday: callsRes.data!.length }));
    }
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .not('status', 'ilike', 'done')
      .gte('due_date', today);
    setStats(prev => ({ ...prev, openTasks: count ?? 0 }));
  }

  useEffect(() => { loadData(); }, []);
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={s.container}>
      <ProwinHeader agentInitials={agentInitials} />
      <PageTitle label="CRM overview" title={`${greeting}, ${agentName}`} />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
      >
        {/* Live indicator */}
        <View style={s.liveRow}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>Live · {format(new Date(), 'EEE d MMM yyyy · HH:mm')}</Text>
        </View>

        {/* Clock-in banner */}
        <TouchableOpacity style={s.clockBanner} onPress={() => router.push('/clockin')}>
          <Ionicons name="time-outline" size={20} color={COLORS.red} />
          <Text style={s.clockText}>Clock in / Check attendance</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.red} />
        </TouchableOpacity>

        {/* Stats */}
        <View style={s.statsGrid}>
          <StatCard label="Total Leads" value={String(stats.totalLeads)} sub="+12 this week" subColor={COLORS.green} />
          <StatCard label="Open Tasks" value={String(stats.openTasks)} sub={stats.openTasks > 0 ? `${stats.openTasks} overdue` : 'All clear'} subColor={stats.openTasks > 0 ? COLORS.red : COLORS.green} />
        </View>
        <View style={[s.statsGrid, { marginTop: 8 }]}>
          <StatCard label="Calls Today" value={String(stats.callsToday)} sub="Target: 10" subColor={COLORS.amber} />
          <StatCard label="Conversion" value={stats.conversion} sub="This month" subColor={COLORS.green} />
        </View>

        {/* Pipeline */}
        <Card style={{ marginTop: 12 }}>
          <Text style={s.pipeLabel}>PIPELINE OVERVIEW</Text>
          <View style={s.pipeBar}>
            <View style={[s.pipeSeg, { flex: pipeline.newL || 1, backgroundColor: COLORS.blue }]} />
            <View style={[s.pipeSeg, { flex: pipeline.hot || 1, backgroundColor: COLORS.red }]} />
            <View style={[s.pipeSeg, { flex: pipeline.warm || 1, backgroundColor: COLORS.amber }]} />
            <View style={[s.pipeSeg, { flex: pipeline.won || 1, backgroundColor: COLORS.green }]} />
          </View>
          <View style={s.pipeLegend}>
            {[['New', COLORS.blue, pipeline.newL], ['Hot', COLORS.red, pipeline.hot], ['Warm', COLORS.amber, pipeline.warm], ['Won', COLORS.green, pipeline.won]].map(([label, color, val]) => (
              <View key={label as string} style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: color as string }]} />
                <Text style={s.legText}>{label} {val}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Upcoming tasks */}
        {upcomingTasks.length > 0 && (
          <>
            <SectionHeader title="upcoming tasks & meetings" />
            {upcomingTasks.map((task) => {
              const typeKey = mapTaskTypeFromDb(task.task_type);
              return (
              <Card key={task.id} topColor={typeKey === 'meeting' ? COLORS.amber : COLORS.blue} style={{ paddingVertical: 11 }}>
                <View style={s.taskRow}>
                  <Ionicons
                    name={typeKey === 'meeting' ? 'location-outline' : 'checkbox-outline'}
                    size={18}
                    color={typeKey === 'meeting' ? COLORS.amber : COLORS.blue}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.taskTitle}>{task.title}</Text>
                    <Text style={s.taskMeta}>{formatTaskDue(task)}</Text>
                  </View>
                </View>
              </Card>
              );
            })}
          </>
        )}

        {/* Recent leads */}
        <SectionHeader title="recent leads" />
        {recentLeads.map((lead) => {
          const leadStatus = lead.lead_status ?? lead.status ?? 'New';
          return (
          <TouchableOpacity key={lead.id} onPress={() => router.push(`/lead/${lead.id}`)}>
            <Card topColor={leadStatus === 'Hot' ? COLORS.red : leadStatus === 'Warm' ? COLORS.amber : COLORS.blue} style={{ paddingVertical: 11 }}>
              <View style={s.leadRow}>
                <LeadAvatar lead={lead} color={COLORS.red} />
                <View style={{ flex: 1 }}>
                  <Text style={s.leadName}>{getName(lead)}</Text>
                  <Text style={s.leadMeta}>{[lead.property_type, lead.area, lead.budget].filter(Boolean).join(' · ')}</Text>
                </View>
                <StatusBadge status={leadStatus} />
              </View>
            </Card>
          </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={s.seeAll} onPress={() => router.push('/(tabs)/leads')}>
          <Text style={s.seeAllText}>See all leads →</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: 14 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green },
  liveText: { fontSize: 11, color: COLORS.muted },
  clockBanner: {
    backgroundColor: COLORS.redLight, borderWidth: 1, borderColor: COLORS.redBorder,
    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  clockText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.red },
  statsGrid: { flexDirection: 'row', gap: 8 },
  pipeLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6, marginBottom: 10 },
  pipeBar: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  pipeSeg: { borderRadius: 2 },
  pipeLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legText: { fontSize: 11, color: COLORS.muted },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  taskMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leadName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  leadMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  seeAll: { alignItems: 'center', paddingVertical: 12 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: COLORS.red },
});
