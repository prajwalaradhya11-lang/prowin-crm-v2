import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl, Linking,
  FlatList, Platform, AppState, AppStateStatus, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, isToday } from 'date-fns';
import { supabase, COLORS } from '../../lib/supabase';
import {
  ProwinHeader, Card, StatusBadge, ContactAvatar, ActionButtons,
} from '../../components/ui';
import { CallLogModal } from '../../components/CallLogModal';
import { LogCallModal } from '../../components/LogCallModal';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';
import { fetchActiveCallStatusOptions } from '../../lib/callStatusOptions';
import { getContactName } from '../../lib/contactName';
import { ColdCallContactListItem, digitsOnly } from '../../lib/coldCallContact';
import {
  setColdCallNavIds,
  getAdjacentContactId,
  getContactNavIndex,
} from '../../lib/coldCallNav';
import {
  fetchArchivedLeadIds,
  filterContactsHideArchivedLeads,
} from '../../lib/applyCallDispositionToLead';
import {
  AgentOption,
  CallLogRow,
  DailyCallStats,
  computeDailyStats,
  fetchAgentOptions,
  fetchCallLogsForAgentDateRange,
  resolveEmployeeIdForUser,
} from '../../lib/callLog';

function toDateIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function ColdCallingScreen() {
  const { user, canManageCallStatuses, loading: sessionLoading } = useCrmSession();

  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [contacts, setContacts] = useState<ColdCallContactListItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ColdCallContactListItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLeadIds, setArchivedLeadIds] = useState<Set<string>>(new Set());

  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState('');
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  const [rangeStart, setRangeStart] = useState(() => new Date());
  const [rangeEnd, setRangeEnd] = useState(() => new Date());
  const [dailyLogs, setDailyLogs] = useState<CallLogRow[]>([]);
  const [stats, setStats] = useState<DailyCallStats>({
    total: 0, connected: 0, notConnected: 0, talkTimeMinutes: 0, prospects: 0,
  });

  const [callLogModalOpen, setCallLogModalOpen] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ColdCallContactListItem | null>(null);
  const [durationLocked, setDurationLocked] = useState(false);
  const [initialDuration, setInitialDuration] = useState('0');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [rangePickerField, setRangePickerField] = useState<'start' | 'end'>('start');

  const pendingCallRef = useRef<{ contactId: string; bgStart: number | null } | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const rangeStartIso = toDateIso(rangeStart);
  const rangeEndIso = toDateIso(rangeEnd);
  const isSingleDay = rangeStartIso === rangeEndIso;
  const isTodayRange = isSingleDay && isToday(rangeStart);
  const isAdminView = canManageCallStatuses;

  const loadStatusOptions = useCallback(async () => {
    const options = await fetchActiveCallStatusOptions();
    setStatusOptions(options.map(o => o.name));
  }, []);

  const initAgent = useCallback(async () => {
    const [employee, agents] = await Promise.all([
      resolveEmployeeIdForUser(user?.email, getUserDisplayName(user)),
      canManageCallStatuses ? fetchAgentOptions() : Promise.resolve([]),
    ]);

    if (canManageCallStatuses) {
      setAgentOptions(agents);
      const defaultAgent = employee ?? agents[0] ?? null;
      if (defaultAgent) {
        setSelectedAgentId(defaultAgent.id);
        setSelectedAgentName(defaultAgent.fullName);
      }
    } else if (employee) {
      setSelectedAgentId(employee.id);
      setSelectedAgentName(employee.fullName);
    }
  }, [user, canManageCallStatuses]);

  const loadContacts = useCallback(async () => {
    if (!selectedAgentId) {
      setContacts([]);
      return;
    }
    const { data, error } = await supabase
      .from('cold_call_contacts')
      .select('id, list_id, full_name, phone, whatsapp, email, location, call_status, call_attempts, last_called_at, last_call_result, assigned_agent_id, assigned_agent_name, lead_id')
      .eq('assigned_agent_id', selectedAgentId)
      .order('full_name');
    if (error) {
      console.log('Contacts fetch error:', error.message);
      setContacts([]);
      return;
    }
    const rows = (data ?? []) as ColdCallContactListItem[];
    setContacts(rows);
    const leadIds = rows.map(c => c.lead_id).filter(Boolean) as string[];
    const archived = await fetchArchivedLeadIds(leadIds);
    setArchivedLeadIds(archived);
  }, [selectedAgentId]);

  const visibleContacts = useMemo(
    () => filterContactsHideArchivedLeads(contacts, archivedLeadIds, showArchived),
    [contacts, archivedLeadIds, showArchived],
  );

  const loadDailyLogs = useCallback(async () => {
    if (!selectedAgentId) {
      setDailyLogs([]);
      setStats({ total: 0, connected: 0, notConnected: 0, talkTimeMinutes: 0, prospects: 0 });
      return;
    }
    const start = rangeStartIso <= rangeEndIso ? rangeStartIso : rangeEndIso;
    const end = rangeStartIso <= rangeEndIso ? rangeEndIso : rangeStartIso;
    const logs = await fetchCallLogsForAgentDateRange(selectedAgentId, start, end);
    setDailyLogs(logs);
    setStats(computeDailyStats(logs));
  }, [selectedAgentId, rangeStartIso, rangeEndIso]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStatusOptions(), loadContacts(), loadDailyLogs()]);
    setLoading(false);
  }, [loadStatusOptions, loadContacts, loadDailyLogs]);

  useEffect(() => {
    if (!sessionLoading && user) initAgent();
  }, [sessionLoading, user, initAgent]);

  useEffect(() => {
    if (selectedAgentId) refreshAll();
  }, [selectedAgentId, rangeStartIso, rangeEndIso, refreshAll]);

  useEffect(() => {
    if (!selectedAgentId) return;
    const channel = supabase
      .channel(`call_logs_${selectedAgentId}_${rangeStartIso}_${rangeEndIso}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs', filter: `agent_id=eq.${selectedAgentId}` },
        () => { loadDailyLogs(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedAgentId, rangeStartIso, rangeEndIso, loadDailyLogs]);

  function applyContactFilters(data: ColdCallContactListItem[], filter: string, q: string) {
    let result = data;
    if (filter !== 'All') {
      result = result.filter(c => (c.call_status ?? 'Not Called') === filter);
    }
    if (q.trim()) {
      const low = q.toLowerCase();
      result = result.filter(c => {
        const displayName = getContactName(c);
        return displayName.toLowerCase().includes(low) ||
          (c.phone ?? '').includes(q) ||
          (c.location ?? '').toLowerCase().includes(low);
      });
    }
    setFilteredContacts(result);
  }

  useEffect(() => {
    applyContactFilters(visibleContacts, activeFilter, search);
  }, [visibleContacts, activeFilter, search]);

  const filterOptions = useMemo(() => ['All', ...statusOptions], [statusOptions]);
  const counts = useMemo(() => {
    return filterOptions.reduce((acc, f) => {
      acc[f] = f === 'All'
        ? visibleContacts.length
        : visibleContacts.filter(c => (c.call_status ?? 'Not Called') === f).length;
      return acc;
    }, {} as Record<string, number>);
  }, [filterOptions, visibleContacts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  function openLogModal(
    contact: ColdCallContactListItem,
    duration = '0',
    locked = false,
  ) {
    setSelectedContact(contact);
    setInitialDuration(duration);
    setDurationLocked(locked);
    setLogModal(true);
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' && pendingCallRef.current) {
        pendingCallRef.current.bgStart = Date.now();
      }

      if (prev.match(/inactive|background/) && nextState === 'active' && pendingCallRef.current?.bgStart) {
        const elapsedMs = Date.now() - pendingCallRef.current.bgStart;
        const mins = Math.max(0, Math.round(elapsedMs / 60000));
        const contactId = pendingCallRef.current.contactId;
        pendingCallRef.current = null;

        const contact = filteredContacts.find(c => c.id === contactId)
          ?? contacts.find(c => c.id === contactId)
          ?? null;
        if (contact) {
          openLogModal(contact, String(mins), true);
        }
      }
    });
    return () => sub.remove();
  }, [filteredContacts, contacts]);

  function closeLogModal() {
    setLogModal(false);
    setSelectedContact(null);
    setDurationLocked(false);
    setInitialDuration('0');
  }

  function openContactDetail(contact: ColdCallContactListItem) {
    setColdCallNavIds(filteredContacts.map(c => c.id));
    router.push(`/coldcall/${contact.id}`);
  }

  function handleInAppCall(contact: ColdCallContactListItem) {
    if (!contact.phone) return;
    pendingCallRef.current = { contactId: contact.id, bgStart: null };
    Linking.openURL(`tel:${contact.phone}`);
  }

  function handleWhatsApp(contact: ColdCallContactListItem) {
    const d = digitsOnly(contact.whatsapp || contact.phone);
    if (!d) return;
    Linking.openURL(`https://wa.me/${d}`);
  }

  function handleEmail(email: string | null | undefined) {
    if (!email?.trim()) return;
    Linking.openURL(`mailto:${email.trim()}`);
  }

  function shiftRange(days: number) {
    setRangeStart(d => addDays(d, days));
    setRangeEnd(d => addDays(d, days));
  }

  function onDatePickerChange(event: { type: string }, date?: Date) {
    if (Platform.OS === 'android') setDatePickerOpen(false);
    if (event.type === 'dismissed') return;
    if (!date) return;
    if (rangePickerField === 'start') {
      setRangeStart(date);
      if (date > rangeEnd) setRangeEnd(date);
    } else {
      setRangeEnd(date);
      if (date < rangeStart) setRangeStart(date);
    }
  }

  function openRangePicker(field: 'start' | 'end') {
    setRangePickerField(field);
    setDatePickerOpen(true);
  }

  function jumpToToday() {
    const today = new Date();
    setRangeStart(today);
    setRangeEnd(today);
  }

  function navigateLogContact(direction: -1 | 1) {
    if (!selectedContact) return;
    const nextId = getAdjacentContactId(selectedContact.id, direction);
    if (!nextId) return;
    const next = filteredContacts.find(c => c.id === nextId);
    if (next) {
      setSelectedContact(next);
      setDurationLocked(false);
      setInitialDuration('0');
    }
  }

  const selectedNavIndex = selectedContact ? getContactNavIndex(selectedContact.id) : -1;
  const logHasPrev = selectedNavIndex > 0;
  const logHasNext = selectedNavIndex >= 0 && selectedNavIndex < filteredContacts.length - 1;

  const listHeader = useMemo(() => (
    <View>
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search name, phone, location..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll} contentContainerStyle={s.pills}>
        {filterOptions.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.pill, activeFilter === f && s.pillActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[s.pillText, activeFilter === f && s.pillTextActive]}>
              {f}{counts[f] > 0 ? ` ${counts[f]}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
        {canManageCallStatuses && (
          <TouchableOpacity
            style={s.addStatusPill}
            onPress={() => router.push('/coldcall/manage-statuses')}
          >
            <Ionicons name="add" size={14} color={COLORS.red} />
            <Text style={s.addStatusText}>Add Status</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={s.countRow}>
        <Text style={s.countText}>
          Showing {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={() => setShowArchived(v => !v)}>
          <Text style={s.archivedToggle}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [search, filterOptions, counts, activeFilter, canManageCallStatuses, filteredContacts.length]);

  function renderContact({ item: contact }: { item: ColdCallContactListItem }) {
    const displayName = getContactName(contact);
    const hasEmail = Boolean(contact.email?.trim());

    return (
      <Card topColor={COLORS.red} style={{ marginHorizontal: 14, marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => openContactDetail(contact)}
        >
          <View style={s.contactTop}>
            <ContactAvatar contact={contact} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={s.contactName}>{displayName}</Text>
              <Text style={s.contactPhone}>{contact.phone ?? '—'}</Text>
              {contact.location ? (
                <Text style={s.contactLoc}>{contact.location}</Text>
              ) : null}
            </View>
            <StatusBadge status={contact.call_status ?? 'Not Called'} />
          </View>
          <View style={s.contactMeta}>
            <Text style={s.metaText}>
              Attempts: {contact.call_attempts ?? 0}
              {contact.last_called_at
                ? ` · Last: ${format(new Date(contact.last_called_at), 'd MMM')}`
                : ''}
            </Text>
            {contact.last_call_result ? (
              <Text style={s.metaText}>Result: {contact.last_call_result}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <ActionButtons
          onCall={() => handleInAppCall(contact)}
          onWhatsApp={() => handleWhatsApp(contact)}
          onEmail={() => handleEmail(contact.email)}
          onView={() => openLogModal(contact)}
          emailDisabled={!hasEmail}
        />
      </Card>
    );
  }

  if (sessionLoading || loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  if (!selectedAgentId && !isAdminView) {
    return (
      <View style={s.container}>
        <ProwinHeader />
        <View style={s.empty}>
          <Ionicons name="person-outline" size={44} color={COLORS.muted} />
          <Text style={s.emptyText}>No agent profile linked</Text>
          <Text style={s.emptySubText}>
            Your account is not linked to an employee record. Ask an admin to match your email in Employees.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ProwinHeader
        rightContent={
          <View style={s.headerActions}>
            <TouchableOpacity style={s.callLogBtn} onPress={() => setCallLogModalOpen(true)}>
              <Ionicons name="list-outline" size={20} color={COLORS.red} />
            </TouchableOpacity>
            {selectedAgentName ? (
              <Text style={s.headerAgentName} numberOfLines={1}>{selectedAgentName}</Text>
            ) : null}
            {canManageCallStatuses && (
              <TouchableOpacity
                style={s.settingsBtn}
                onPress={() => router.push('/coldcall/manage-statuses')}
              >
                <Ionicons name="settings-outline" size={20} color={COLORS.red} />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {isAdminView && (
        <TouchableOpacity style={s.agentRow} onPress={() => setAgentPickerOpen(true)}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.red} />
          <Text style={s.agentLabel}>Agent</Text>
          <Text style={s.agentValue} numberOfLines={1}>
            {selectedAgentName || 'Select agent'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.muted} />
        </TouchableOpacity>
      )}

      <View style={s.statsCard}>
        <View style={s.statsHeader}>
          <Text style={s.statsTitle}>
            {isSingleDay && isTodayRange ? 'Daily call stats' : 'Call stats (range)'}
          </Text>
          <View style={s.dateNav}>
            <TouchableOpacity onPress={() => shiftRange(-1)} style={s.dateBtn}>
              <Ionicons name="chevron-back" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openRangePicker('start')} style={s.dateLabelBtn}>
              <Text style={s.dateLabel}>
                {isSingleDay
                  ? (isTodayRange ? 'Today' : format(rangeStart, 'EEE d MMM yyyy'))
                  : `${format(rangeStart, 'd MMM')} – ${format(rangeEnd, 'd MMM yyyy')}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => shiftRange(1)}
              style={s.dateBtn}
              disabled={isTodayRange}
            >
              <Ionicons name="chevron-forward" size={18} color={isTodayRange ? COLORS.mutedLight : COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
        {!isTodayRange && (
          <TouchableOpacity onPress={jumpToToday} style={s.todayLink}>
            <Text style={s.todayLinkText}>Jump to today</Text>
          </TouchableOpacity>
        )}
        {!isSingleDay && (
          <View style={s.rangeRow}>
            <TouchableOpacity style={s.rangeChip} onPress={() => openRangePicker('start')}>
              <Text style={s.rangeChipLabel}>Start</Text>
              <Text style={s.rangeChipVal}>{format(rangeStart, 'd MMM yyyy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.rangeChip} onPress={() => openRangePicker('end')}>
              <Text style={s.rangeChipLabel}>End</Text>
              <Text style={s.rangeChipVal}>{format(rangeEnd, 'd MMM yyyy')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Text style={s.statVal}>{stats.total}</Text>
            <Text style={s.statLbl}>Total</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statVal, { color: COLORS.green }]}>{stats.connected}</Text>
            <Text style={s.statLbl}>Connected</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{stats.talkTimeMinutes}m</Text>
            <Text style={s.statLbl}>Talk-time</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statVal, { color: COLORS.amber }]}>{stats.prospects}</Text>
            <Text style={s.statLbl}>Prospects</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{stats.notConnected}</Text>
            <Text style={s.statLbl}>Not conn.</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={item => item.id}
        renderItem={renderContact}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="call-outline" size={44} color={COLORS.muted} />
            <Text style={s.emptyText}>No contacts found</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
        contentContainerStyle={s.listContent}
        style={s.list}
      />

      <CallLogModal
        visible={callLogModalOpen}
        onClose={() => setCallLogModalOpen(false)}
        logs={dailyLogs}
        statsDate={rangeStart}
        statsEndDate={rangeEnd}
      />

      <LogCallModal
        visible={logModal}
        contact={selectedContact}
        selectedAgentId={selectedAgentId}
        selectedAgentName={selectedAgentName}
        durationLocked={durationLocked}
        initialDurationMinutes={initialDuration}
        hasPrev={logHasPrev}
        hasNext={logHasNext}
        onPrev={() => navigateLogContact(-1)}
        onNext={() => navigateLogContact(1)}
        onClose={closeLogModal}
        onSaved={refreshAll}
        onCall={handleInAppCall}
        onWhatsApp={handleWhatsApp}
        onEmail={(c) => handleEmail(c.email)}
      />

      <Modal visible={agentPickerOpen} animationType="fade" transparent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setAgentPickerOpen(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select agent</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {agentOptions.map(agent => (
                <TouchableOpacity
                  key={agent.id}
                  style={[s.pickerRow, selectedAgentId === agent.id && s.pickerRowActive]}
                  onPress={() => {
                    setSelectedAgentId(agent.id);
                    setSelectedAgentName(agent.fullName);
                    setAgentPickerOpen(false);
                  }}
                >
                  <Text style={s.pickerRowText}>{agent.fullName}</Text>
                  {selectedAgentId === agent.id && (
                    <Ionicons name="checkmark" size={18} color={COLORS.red} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {datePickerOpen && Platform.OS === 'android' && (
        <DateTimePicker
          value={rangePickerField === 'start' ? rangeStart : rangeEnd}
          mode="date"
          display="calendar"
          onChange={onDatePickerChange}
        />
      )}

      {datePickerOpen && Platform.OS === 'ios' && (
        <Modal visible animationType="slide" transparent>
          <View style={s.overlay}>
            <View style={s.datePickerSheet}>
              <View style={s.datePickerHeader}>
                <Text style={s.pickerTitle}>
                  {rangePickerField === 'start' ? 'Start date' : 'End date'}
                </Text>
                <TouchableOpacity onPress={() => setDatePickerOpen(false)}>
                  <Text style={s.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={rangePickerField === 'start' ? rangeStart : rangeEnd}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (!date) return;
                  if (rangePickerField === 'start') {
                    setRangeStart(date);
                    if (date > rangeEnd) setRangeEnd(date);
                  } else {
                    setRangeEnd(date);
                    if (date < rangeStart) setRangeStart(date);
                  }
                }}
                style={{ alignSelf: 'center' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200 },
  callLogBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.redLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.redBorder,
  },
  headerAgentName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'right',
  },
  settingsBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.redLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.redBorder,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  agentLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  agentValue: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  statsCard: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  statsTitle: { fontSize: 11, fontWeight: '800', color: COLORS.red, letterSpacing: 0.3 },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dateBtn: { padding: 4 },
  dateLabelBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  dateLabel: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  todayLink: { alignSelf: 'flex-start', marginBottom: 4 },
  todayLinkText: { fontSize: 10, fontWeight: '600', color: COLORS.red },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  rangeChip: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rangeChipLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted },
  rangeChipVal: { fontSize: 11, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 4 },
  statCell: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 10, fontWeight: '600', color: COLORS.muted, marginTop: 1, textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, marginHorizontal: 14, marginTop: 4, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 2,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, paddingVertical: 9 },
  pillsScroll: { flexGrow: 0, marginBottom: 0 },
  pills: { paddingHorizontal: 14, gap: 6, paddingBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pillActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  pillTextActive: { color: '#fff' },
  addStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.redBorder, backgroundColor: COLORS.redLight,
  },
  addStatusText: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  countRow: { paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countText: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  archivedToggle: { fontSize: 11, fontWeight: '700', color: COLORS.red },
  list: { flex: 1 },
  listContent: { paddingBottom: 90 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.muted },
  emptySubText: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
  contactTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  contactName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  contactPhone: { fontSize: 12, fontWeight: '600', color: COLORS.red, marginTop: 4 },
  contactLoc: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  contactMeta: { gap: 2, marginBottom: 10 },
  metaText: { fontSize: 11, color: COLORS.muted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 32, maxHeight: '70%',
  },
  datePickerSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  datePickerDone: { fontSize: 15, fontWeight: '700', color: COLORS.red },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerRowActive: { backgroundColor: COLORS.redLight },
  pickerRowText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});
