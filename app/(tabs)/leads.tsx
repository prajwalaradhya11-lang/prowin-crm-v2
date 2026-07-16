import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Linking, RefreshControl, Modal,
  ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Pressable, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ProwinHeader } from '../../components/ui';
import { LeadCompactCard } from '../../components/leads/LeadCompactCard';
import { LeadStatusTabsPager } from '../../components/leads/LeadStatusTabsPager';
import { generateFollowUpMessage } from '../../lib/ai';
import { getName } from '../../lib/leadName';
import { useCrmSession } from '../../hooks/useCrmSession';
import { fetchActiveStatusOptions } from '../../lib/leadStatus';
import { filterLeadsForUser, resolveUserEmployeeId } from '../../lib/rbac';
import {
  getLeadAreaLabel,
  isLeadArchived,
  matchesLeadSearch,
  getLeadPipelineStatus,
  isLeadActiveForStats,
  LEAD_STATUS_CALLBACK,
  LEAD_STATUS_MEETING_SCHEDULED,
} from '../../lib/leadFields';
import { setLeadNavIds } from '../../lib/leadNav';
import { THEME } from '../../lib/prowinTheme';
import {
  buildDatedExportBasename,
  exportRowsToFileUri,
  shareExportFile,
} from '../../lib/exportDownload';
import { fetchAllLeads } from '../../lib/fetchAllLeads';
import { LEADS_EXPORT_COLUMNS } from '../../lib/leadsExportColumns';

type QuickStatFilter = null | 'total' | 'active' | 'callback' | 'meetings';

const STAT_COLORS = {
  total: '#1a1a1a',
  active: '#1FA971',
  callback: '#E28A2B',
  meetings: '#2563EB',
  label: '#999999',
  border: '#ececec',
};

function StatCard({
  label,
  value,
  accentColor,
  tintBg,
  selected,
  onPress,
}: {
  label: string;
  value: number;
  accentColor: string;
  tintBg: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        s.statCard,
        { borderTopColor: accentColor },
        selected && { backgroundColor: tintBg, borderColor: accentColor },
      ]}
      onPress={onPress}
    >
      <Text style={[s.statValue, { color: accentColor }]}>{Math.round(value)}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Pressable>
  );
}

export default function LeadsScreen() {
  const { user, role, canManageStatuses, loading: sessionLoading } = useCrmSession();
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [quickFilter, setQuickFilter] = useState<QuickStatFilter>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [msgModal, setMsgModal] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgType, setMsgType] = useState<'whatsapp' | 'email'>('whatsapp');
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const loadOptions = useCallback(async () => {
    const statuses = await fetchActiveStatusOptions();
    setStatusOptions(statuses.map(o => o.name));
  }, []);

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      const employeeId = await resolveUserEmployeeId(user);
      const scoped = filterLeadsForUser(data, user, role, employeeId);
      setLeads(scoped);
    }
    if (error) console.log('Leads fetch error:', error.message);
    setLoading(false);
  }, [user, role]);

  const getLeadStatus = useCallback((lead: any) => getLeadPipelineStatus(lead), []);

  const listBaseLeads = useMemo(() => {
    switch (quickFilter) {
      case 'total':
        return leads;
      case 'active':
        return leads.filter(isLeadActiveForStats);
      case 'callback':
        return leads.filter(l => getLeadStatus(l) === LEAD_STATUS_CALLBACK);
      case 'meetings':
        return leads.filter(l => getLeadStatus(l) === LEAD_STATUS_MEETING_SCHEDULED);
      default:
        return leads.filter(l => !isLeadArchived(l));
    }
  }, [leads, quickFilter, getLeadStatus]);

  const statCounts = useMemo(() => ({
    total: leads.length,
    active: leads.filter(isLeadActiveForStats).length,
    callback: leads.filter(l => getLeadStatus(l) === LEAD_STATUS_CALLBACK).length,
    meetings: leads.filter(l => getLeadStatus(l) === LEAD_STATUS_MEETING_SCHEDULED).length,
  }), [leads, getLeadStatus]);

  const filterOptions = useMemo(() => ['All', ...statusOptions], [statusOptions]);

  const tabs = useMemo(() => {
    return filterOptions.map(label => ({
      key: label,
      label,
      count: label === 'All'
        ? listBaseLeads.length
        : listBaseLeads.filter(l => getLeadStatus(l) === label).length,
    }));
  }, [filterOptions, listBaseLeads, getLeadStatus]);

  const leadsByTab = useMemo(() => {
    return filterOptions.map(filter => {
      let result = listBaseLeads;
      if (filter !== 'All') {
        result = result.filter(l => getLeadStatus(l) === filter);
      }
      if (search.trim()) {
        result = result.filter(l => matchesLeadSearch(l, search, getName));
      }
      return result;
    });
  }, [filterOptions, listBaseLeads, search, getLeadStatus]);

  const handleStatCardPress = useCallback((filter: QuickStatFilter) => {
    if (quickFilter === filter) {
      setQuickFilter(null);
      setActiveTabIndex(0);
      return;
    }
    setQuickFilter(filter);
    if (filter === 'callback') {
      const idx = filterOptions.indexOf(LEAD_STATUS_CALLBACK);
      setActiveTabIndex(idx >= 0 ? idx : 0);
    } else if (filter === 'meetings') {
      const idx = filterOptions.indexOf(LEAD_STATUS_MEETING_SCHEDULED);
      setActiveTabIndex(idx >= 0 ? idx : 0);
    } else {
      setActiveTabIndex(0);
    }
  }, [quickFilter, filterOptions]);

  const handleTabIndexChange = useCallback((index: number) => {
    setQuickFilter(null);
    setActiveTabIndex(index);
  }, []);

  useEffect(() => {
    loadOptions();
    fetchLeads();
  }, [loadOptions, fetchLeads]);

  useEffect(() => {
    if (activeTabIndex >= filterOptions.length) {
      setActiveTabIndex(0);
    }
  }, [activeTabIndex, filterOptions.length]);

  useEffect(() => {
    if (!initialStatus?.trim() || !filterOptions.length) return;
    const idx = filterOptions.findIndex(
      opt => opt.toLowerCase() === initialStatus.trim().toLowerCase(),
    );
    if (idx >= 0) {
      setActiveTabIndex(idx);
      const status = initialStatus.trim();
      if (status.toLowerCase() === LEAD_STATUS_CALLBACK.toLowerCase()) {
        setQuickFilter('callback');
      } else if (status.toLowerCase() === LEAD_STATUS_MEETING_SCHEDULED.toLowerCase()) {
        setQuickFilter('meetings');
      }
    }
  }, [initialStatus, filterOptions]);

  useFocusEffect(
    useCallback(() => {
      loadOptions();
    }, [loadOptions]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOptions(), fetchLeads()]);
    setRefreshing(false);
  }, [loadOptions, fetchLeads]);

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  const handleWhatsApp = useCallback(async (phone: string, lead: any) => {
    setSelectedLead(lead);
    setMsgType('whatsapp');
    setMsgModal(true);
    setGeneratedMsg('');
    setMsgLoading(true);
    const msg = await generateFollowUpMessage(
      getName(lead),
      [lead.property_type, getLeadAreaLabel(lead), lead.budget].filter(Boolean).join(' in '),
      'whatsapp',
    );
    setGeneratedMsg(msg);
    setMsgLoading(false);
  }, []);

  const sendMessage = useCallback(() => {
    if (!selectedLead) return;
    if (msgType === 'whatsapp') {
      const phone = selectedLead.phone?.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(generatedMsg)}`);
    } else {
      Linking.openURL(`mailto:${selectedLead.email}?body=${encodeURIComponent(generatedMsg)}`);
    }
    setMsgModal(false);
  }, [selectedLead, msgType, generatedMsg]);

  const openLeadDetail = useCallback((lead: any) => {
    const pageLeads = leadsByTab[activeTabIndex] ?? [];
    setLeadNavIds(pageLeads.map(l => l.id));
    router.push(`/lead/${lead.id}`);
  }, [activeTabIndex, leadsByTab]);

  const runLeadsExport = useCallback(
    async (scope: 'filtered' | 'all') => {
      setExporting(true);
      try {
        let rows: any[];
        if (scope === 'filtered') {
          rows = leadsByTab[activeTabIndex] ?? [];
          if (rows.length === 0) {
            Alert.alert('Export', 'No leads in the current filtered view to export.');
            return;
          }
        } else {
          const { data, error } = await fetchAllLeads(user, role);
          if (error) throw error;
          rows = data;
          if (rows.length === 0) {
            Alert.alert('Export', 'No leads to export.');
            return;
          }
        }

        const uri = await exportRowsToFileUri({
          rows,
          columns: LEADS_EXPORT_COLUMNS,
          filename: buildDatedExportBasename('leads'),
        });
        await shareExportFile(uri, { dialogTitle: 'Export leads CSV' });
      } catch (e) {
        Alert.alert(
          'Export failed',
          e instanceof Error ? e.message : 'Could not export leads.',
        );
      } finally {
        setExporting(false);
      }
    },
    [activeTabIndex, leadsByTab, role, user],
  );

  const handleExportPress = useCallback(() => {
    if (exporting) return;
    Alert.alert('Export leads', 'Choose which leads to export as CSV.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Current filtered view',
        onPress: () => void runLeadsExport('filtered'),
      },
      {
        text: 'All records',
        onPress: () => void runLeadsExport('all'),
      },
    ]);
  }, [exporting, runLeadsExport]);

  const renderLeadPage = useCallback((tabIndex: number) => {
    const pageLeads = leadsByTab[tabIndex] ?? [];
    return (
      <FlatList
        data={pageLeads}
        keyExtractor={item => item.id}
        style={s.list}
        contentContainerStyle={pageLeads.length === 0 ? s.listEmptyContent : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          tabIndex === activeTabIndex
            ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.red} />
            : undefined
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={48} color={THEME.meta} />
            <Text style={s.emptyText}>No leads found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <LeadCompactCard
            lead={item}
            statusLabel={getLeadStatus(item)}
            onPress={() => openLeadDetail(item)}
            onCall={() => handleCall(item.phone)}
            onWhatsApp={() => handleWhatsApp(item.phone, item)}
          />
        )}
      />
    );
  }, [activeTabIndex, leadsByTab, refreshing, onRefresh, getLeadStatus, openLeadDetail, handleCall, handleWhatsApp]);

  return (
    <View style={s.container}>
      <ProwinHeader
        rightContent={
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.exportBtn}
              onPress={handleExportPress}
              disabled={exporting || loading}
              accessibilityLabel="Export leads"
            >
              {exporting ? (
                <ActivityIndicator size="small" color={THEME.red} />
              ) : (
                <Ionicons name="download-outline" size={20} color={THEME.red} />
              )}
            </TouchableOpacity>
            {!sessionLoading && canManageStatuses && (
              <TouchableOpacity
                style={s.settingsBtn}
                onPress={() => router.push('/lead/manage-statuses')}
              >
                <Ionicons name="settings-outline" size={20} color={THEME.red} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.addBtn} onPress={() => router.push('/lead/new')}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        }
      />

      <View style={s.statsRow}>
        <StatCard
          label="TOTAL"
          value={statCounts.total}
          accentColor={STAT_COLORS.total}
          tintBg="#f3f3f3"
          selected={quickFilter === 'total'}
          onPress={() => handleStatCardPress('total')}
        />
        <StatCard
          label="ACTIVE"
          value={statCounts.active}
          accentColor={STAT_COLORS.active}
          tintBg="#e9f7ef"
          selected={quickFilter === 'active'}
          onPress={() => handleStatCardPress('active')}
        />
        <StatCard
          label="CALLBACK"
          value={statCounts.callback}
          accentColor={STAT_COLORS.callback}
          tintBg="#fef3e0"
          selected={quickFilter === 'callback'}
          onPress={() => handleStatCardPress('callback')}
        />
        <StatCard
          label="MEETINGS"
          value={statCounts.meetings}
          accentColor={STAT_COLORS.meetings}
          tintBg="#eef4fc"
          selected={quickFilter === 'meetings'}
          onPress={() => handleStatCardPress('meetings')}
        />
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={THEME.meta} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name, phone, area, budget..."
          placeholderTextColor={THEME.meta}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={THEME.meta} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.red} style={{ marginTop: 40 }} />
      ) : (
        <LeadStatusTabsPager
          tabs={tabs}
          activeIndex={activeTabIndex}
          onIndexChange={handleTabIndexChange}
          renderPage={(_, index) => renderLeadPage(index)}
        />
      )}

      <Modal visible={msgModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>WhatsApp Message — AI drafted</Text>
            <TouchableOpacity onPress={() => setMsgModal(false)}>
              <Ionicons name="close" size={24} color={THEME.heading} />
            </TouchableOpacity>
          </View>
          {msgLoading ? (
            <View style={s.modalLoading}>
              <ActivityIndicator color={THEME.red} size="large" />
              <Text style={s.modalLoadingText}>AI is drafting your message...</Text>
            </View>
          ) : (
            <ScrollView style={s.modalBody}>
              <View style={s.aiBox}>
                <View style={s.aiHeader}>
                  <Ionicons name="sparkles" size={13} color={THEME.red} />
                  <Text style={s.aiLabel}>AI-drafted message — edit before sending</Text>
                </View>
                <Text style={s.msgText}>{generatedMsg}</Text>
              </View>
              <TouchableOpacity style={s.sendBtn} onPress={sendMessage}>
                <Text style={s.sendBtnText}>Open in WhatsApp</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.page },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: THEME.redTintFill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: THEME.redTintBorder,
  },
  settingsBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: THEME.redTintFill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: THEME.redTintBorder,
  },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: THEME.red,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: STAT_COLORS.border,
    borderTopWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: STAT_COLORS.label,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border,
    borderRadius: 12, marginHorizontal: 14, marginTop: 8, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 2,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: THEME.heading, paddingVertical: 9 },
  list: { flex: 1, paddingHorizontal: 14 },
  listContent: { paddingBottom: 24 },
  listEmptyContent: { flexGrow: 1, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: THEME.meta },
  modal: { flex: 1, backgroundColor: THEME.page },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, backgroundColor: THEME.card,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: THEME.heading },
  modalLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  modalLoadingText: { fontSize: 14, color: THEME.meta },
  modalBody: { padding: 14 },
  aiBox: {
    backgroundColor: THEME.redTintFill, borderWidth: 1, borderColor: THEME.redTintBorder,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: THEME.red },
  msgText: { fontSize: 14, color: THEME.heading, lineHeight: 22 },
  sendBtn: {
    backgroundColor: THEME.red, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
