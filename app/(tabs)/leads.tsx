import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Linking, RefreshControl, Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import {
  ProwinHeader, PageTitle, StatusBadge,
  AISummary, ActionButtons, Card, Avatar,
} from '../../components/ui';
import { LeadOptionPicker } from '../../components/LeadOptionPicker';
import { generateFollowUpMessage } from '../../lib/ai';
import { useCrmSession } from '../../hooks/useCrmSession';
import {
  fetchActiveStatusOptions,
  fetchActiveReasonOptions,
  updateLeadStatus,
  updateLeadStatusReason,
} from '../../lib/leadStatus';

export default function LeadsScreen() {
  const { user, canManageStatuses, loading: sessionLoading } = useCrmSession();
  const [leads, setLeads] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [msgModal, setMsgModal] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgType, setMsgType] = useState<'whatsapp' | 'email'>('whatsapp');
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [reasonOptions, setReasonOptions] = useState<string[]>([]);

  async function loadOptions() {
    const [statuses, reasons] = await Promise.all([
      fetchActiveStatusOptions(),
      fetchActiveReasonOptions(),
    ]);
    setStatusOptions(statuses.map(o => o.name));
    setReasonOptions(reasons.map(o => o.name));
  }

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) { setLeads(data); applyFilters(data, activeFilter, search); }
    if (error) console.log('Leads fetch error:', error.message);
    setLoading(false);
  }

  function getLeadStatus(lead: any) {
    return lead.lead_status ?? lead.status ?? 'New';
  }

  function applyFilters(data: any[], filter: string, q: string) {
    let result = data;
    if (filter !== 'All') {
      result = result.filter(l => getLeadStatus(l) === filter);
    }
    if (q.trim()) {
      const low = q.toLowerCase();
      result = result.filter(l =>
        (l.lead_name ?? l.name ?? '').toLowerCase().includes(low) ||
        l.phone?.includes(q) ||
        l.area?.toLowerCase().includes(low) ||
        String(l.budget ?? '').toLowerCase().includes(low)
      );
    }
    setFiltered(result);
  }

  useEffect(() => {
    loadOptions();
    fetchLeads();
  }, []);

  useEffect(() => { applyFilters(leads, activeFilter, search); }, [activeFilter, search, leads]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOptions(), fetchLeads()]);
    setRefreshing(false);
  };

  function handleCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function handleWhatsApp(phone: string, lead: any) {
    setSelectedLead(lead);
    setMsgType('whatsapp');
    openMsgModal(lead, 'whatsapp');
  }

  function handleEmail(email: string, lead: any) {
    setSelectedLead(lead);
    setMsgType('email');
    openMsgModal(lead, 'email');
  }

  async function openMsgModal(lead: any, type: 'whatsapp' | 'email') {
    setMsgModal(true);
    setGeneratedMsg('');
    setMsgLoading(true);
    const msg = await generateFollowUpMessage(
      lead.name,
      [lead.property_type, lead.area, lead.budget].filter(Boolean).join(' in '),
      type
    );
    setGeneratedMsg(msg);
    setMsgLoading(false);
  }

  function sendMessage() {
    if (!selectedLead) return;
    if (msgType === 'whatsapp') {
      const phone = selectedLead.phone?.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(generatedMsg)}`);
    } else {
      Linking.openURL(`mailto:${selectedLead.email}?body=${encodeURIComponent(generatedMsg)}`);
    }
    setMsgModal(false);
  }

  async function handleStatusChange(lead: any, newStatus: string) {
    const oldStatus = getLeadStatus(lead);
    if (oldStatus === newStatus) return;
    const doneBy = user?.full_name ?? user?.email ?? 'Unknown';
    await updateLeadStatus(lead.id, oldStatus, newStatus, doneBy);
    fetchLeads();
  }

  async function handleReasonChange(leadId: string, newReason: string) {
    await updateLeadStatusReason(leadId, newReason);
    fetchLeads();
  }

  function getTopBorderColor(status: string) {
    if (status === 'Hot' || status === 'Not Interested') return COLORS.red;
    if (status === 'Warm' || status === 'Callback' || status === 'Pending') return COLORS.amber;
    if (status === 'Won' || status === 'Booked' || status === 'Invoiced') return COLORS.green;
    return COLORS.blue;
  }

  const filterOptions = ['All', ...statusOptions.slice(0, 8)];
  const counts = filterOptions.reduce((acc, f) => {
    acc[f] = f === 'All' ? leads.length : leads.filter(l => getLeadStatus(l) === f).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={s.container}>
      <ProwinHeader
        rightContent={
          <View style={s.headerActions}>
            {!sessionLoading && canManageStatuses && (
              <TouchableOpacity
                style={s.settingsBtn}
                onPress={() => router.push('/lead/manage-statuses')}
              >
                <Ionicons name="settings-outline" size={20} color={COLORS.red} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.addBtn} onPress={() => router.push('/lead/new')}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        }
      />
      <PageTitle label={`CRM · ${leads.length} total leads`} title="Leads" />

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name, phone, area, budget..."
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
              {f} {counts[f] > 0 ? counts[f] : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.countRow}>
        <Text style={s.countText}>Showing {filtered.length} lead{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading
        ? <ActivityIndicator color={COLORS.red} style={{ marginTop: 40 }} />
        : (
          <ScrollView
            style={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
          >
            {filtered.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={48} color={COLORS.muted} />
                <Text style={s.emptyText}>No leads found</Text>
              </View>
            )}
            {filtered.map((lead) => {
              const leadStatus = getLeadStatus(lead);
              return (
                <Card key={lead.id} topColor={getTopBorderColor(leadStatus)}>
                  <View style={s.leadTop}>
                    <Avatar
                      initials={(lead.name ?? lead.lead_name ?? '??').split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                      color={getTopBorderColor(leadStatus)}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.leadName}>{lead.name ?? lead.lead_name}</Text>
                      <View style={s.phoneRow}>
                        <Ionicons name="call-outline" size={11} color={COLORS.muted} />
                        <Text style={s.leadPhone}>{lead.phone}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge status={leadStatus} />
                      <Text style={s.timeAgo}>
                        {lead.last_contacted_at
                          ? new Date(lead.last_contacted_at).toLocaleDateString()
                          : new Date(lead.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <View style={s.propGrid}>
                    <View style={s.propTile}>
                      <Text style={s.propLabel}>PROPERTY</Text>
                      <Text style={s.propVal}>{lead.property_type ?? '—'}</Text>
                    </View>
                    <View style={s.propTile}>
                      <Text style={s.propLabel}>AREA</Text>
                      <Text style={s.propVal}>{lead.area ?? '—'}</Text>
                    </View>
                    <View style={s.propTile}>
                      <Text style={s.propLabel}>BUDGET</Text>
                      <Text style={s.propVal}>{lead.budget ?? '—'}</Text>
                    </View>
                    <View style={s.propTile}>
                      <Text style={s.propLabel}>PURPOSE</Text>
                      <Text style={s.propVal}>{lead.purpose ?? '—'}</Text>
                    </View>
                  </View>

                  {lead.ai_summary && <AISummary text={lead.ai_summary} />}

                  <View style={s.statusPickers}>
                    <LeadOptionPicker
                      label="Status"
                      value={leadStatus}
                      options={statusOptions}
                      onChange={v => handleStatusChange(lead, v)}
                      compact
                    />
                    <LeadOptionPicker
                      label="Status Reason"
                      value={lead.status_reason}
                      options={reasonOptions}
                      onChange={v => handleReasonChange(lead.id, v)}
                      compact
                    />
                  </View>

                  <View style={s.divider} />

                  <ActionButtons
                    onCall={() => handleCall(lead.phone)}
                    onWhatsApp={() => handleWhatsApp(lead.phone, lead)}
                    onEmail={() => handleEmail(lead.email, lead)}
                    onView={() => router.push(`/lead/${lead.id}`)}
                  />
                </Card>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}

      <Modal visible={msgModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {msgType === 'whatsapp' ? 'WhatsApp Message' : 'Email'} — AI drafted
            </Text>
            <TouchableOpacity onPress={() => setMsgModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {msgLoading
            ? (
              <View style={s.modalLoading}>
                <ActivityIndicator color={COLORS.red} size="large" />
                <Text style={s.modalLoadingText}>AI is drafting your message...</Text>
              </View>
            )
            : (
              <ScrollView style={s.modalBody}>
                <View style={s.aiBox}>
                  <View style={s.aiHeader}>
                    <Ionicons name="sparkles" size={13} color={COLORS.red} />
                    <Text style={s.aiLabel}>AI-drafted message — edit before sending</Text>
                  </View>
                  <Text style={s.msgText}>{generatedMsg}</Text>
                </View>
                <TouchableOpacity style={s.sendBtn} onPress={sendMessage}>
                  <Ionicons name={msgType === 'whatsapp' ? 'logo-whatsapp' : 'mail'} size={18} color="#fff" />
                  <Text style={s.sendBtnText}>
                    Open in {msgType === 'whatsapp' ? 'WhatsApp' : 'Mail'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.redLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.redBorder,
  },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, marginHorizontal: 14, marginTop: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 2 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, paddingVertical: 9 },
  pillsScroll: { flexGrow: 0 },
  pills: { paddingHorizontal: 14, gap: 6, paddingBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pillActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  pillTextActive: { color: '#fff' },
  countRow: { paddingHorizontal: 14, paddingVertical: 8 },
  countText: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  list: { flex: 1, paddingHorizontal: 14 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.muted },
  leadTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  leadName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  leadPhone: { fontSize: 11, color: COLORS.muted },
  timeAgo: { fontSize: 10, color: COLORS.muted },
  propGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  propTile: { flex: 1, minWidth: '45%', backgroundColor: COLORS.bg, borderRadius: 8, padding: 8 },
  propLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.4, marginBottom: 2 },
  propVal: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  statusPickers: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  modalLoadingText: { fontSize: 14, color: COLORS.muted },
  modalBody: { flex: 1, padding: 14 },
  aiBox: { backgroundColor: COLORS.redLight, borderWidth: 1, borderColor: COLORS.redBorder, borderRadius: 12, padding: 14, marginBottom: 16 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: COLORS.red },
  msgText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  sendBtn: { backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
