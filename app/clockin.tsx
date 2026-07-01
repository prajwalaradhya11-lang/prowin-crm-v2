import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase, COLORS } from '../lib/supabase';
import { Card } from '../components/ui';
import { format, isToday, parseISO } from 'date-fns';

export default function ClockInScreen() {
  const [loading, setLoading] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInType, setClockInType] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [leadModal, setLeadModal] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [agentId, setAgentId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setAgentId(user.id);

    const today = new Date().toISOString().slice(0, 10);
    const { data: todayRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('agent_id', user?.id)
      .gte('created_at', today + 'T00:00:00')
      .limit(1)
      .single();

    if (todayRecord) {
      setClockedIn(true);
      setClockInType(todayRecord.type);
    }

    const { data: histData } = await supabase
      .from('attendance')
      .select('*')
      .eq('agent_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(7);

    if (histData) setHistory(histData);

    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, name, area')
      .order('created_at', { ascending: false });
    if (leadsData) setLeads(leadsData);
  }

  async function clockIn(type: 'office' | 'meeting', leadId?: string, leadName?: string) {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = null, lng = null, address = null;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        address = [geo.street, geo.district, geo.city].filter(Boolean).join(', ');
      }

      const { error } = await supabase.from('attendance').insert({
        agent_id: agentId,
        type,
        lead_id: leadId ?? null,
        lead_name: leadName ?? null,
        latitude: lat,
        longitude: lng,
        location_address: address,
        created_at: new Date().toISOString(),
      });

      if (!error) {
        setClockedIn(true);
        setClockInType(type);
        setLeadModal(false);
        loadData();
      }
    } catch (e) {
      Alert.alert('Error', 'Could not clock in. Try again.');
    }
    setLoading(false);
  }

  function handleOffice() { clockIn('office'); }
  function handleMeeting() { setLeadModal(true); }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-down" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Time card */}
        <View style={s.timeCard}>
          <Text style={s.timeText}>{format(new Date(), 'HH:mm')}</Text>
          <Text style={s.dateText}>{format(new Date(), 'EEEE, d MMMM yyyy')}</Text>

          {!clockedIn ? (
            <>
              <Text style={s.promptText}>Where are you today?</Text>
              <View style={s.clockBtns}>
                <TouchableOpacity style={s.officeBtn} onPress={handleOffice} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="business-outline" size={20} color="#fff" />
                        <Text style={s.officeBtnText}>In the office</Text>
                      </>}
                </TouchableOpacity>
                <TouchableOpacity style={s.meetBtn} onPress={handleMeeting} disabled={loading}>
                  <Ionicons name="location-outline" size={20} color={COLORS.amber} />
                  <Text style={s.meetBtnText}>Going for a meeting</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={s.clockedRow}>
              <View style={s.clockedIcon}>
                <Ionicons
                  name={clockInType === 'office' ? 'business' : 'location'}
                  size={24}
                  color={COLORS.green}
                />
              </View>
              <View>
                <Text style={s.clockedText}>
                  {clockInType === 'office' ? 'In the office' : 'At a meeting'}
                </Text>
                <Text style={s.clockedSub}>Clocked in today at {format(new Date(), 'HH:mm')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* History */}
        {history.length > 0 && (
          <>
            <Text style={s.histTitle}>THIS WEEK</Text>
            {history.map((rec) => (
              <Card key={rec.id} topColor={rec.type === 'office' ? COLORS.green : COLORS.amber} style={{ paddingVertical: 11 }}>
                <View style={s.histRow}>
                  <Ionicons
                    name={rec.type === 'office' ? 'business-outline' : 'location-outline'}
                    size={18}
                    color={rec.type === 'office' ? COLORS.green : COLORS.amber}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.histTitle2}>
                      {rec.type === 'office' ? 'In the office' : `Meeting — ${rec.lead_name ?? 'Client'}`}
                    </Text>
                    <Text style={s.histMeta}>
                      {format(parseISO(rec.created_at), 'EEE d MMM · HH:mm')}
                      {rec.location_address ? ` · ${rec.location_address}` : ''}
                    </Text>
                  </View>
                  <View style={[s.checkBadge, { backgroundColor: COLORS.greenLight }]}>
                    <Ionicons name="checkmark" size={14} color={COLORS.green} />
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Lead picker modal */}
      <Modal visible={leadModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Which lead are you visiting?</Text>
            <TouchableOpacity onPress={() => setLeadModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 14 }}>
            <Text style={s.modalSub}>Your GPS location will be saved and linked to this lead's timeline.</Text>
            {leads.map(lead => (
              <TouchableOpacity
                key={lead.id}
                style={s.leadRow}
                onPress={() => clockIn('meeting', lead.id, lead.name)}
                disabled={loading}
              >
                <View style={s.leadAvatar}>
                  <Text style={s.leadAvatarText}>{lead.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.leadRowName}>{lead.name}</Text>
                  {lead.area && <Text style={s.leadRowMeta}>{lead.area}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  scroll: { flex: 1, padding: 14 },
  timeCard: { backgroundColor: COLORS.navy, borderRadius: 18, padding: 22, marginBottom: 20, alignItems: 'center' },
  timeText: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  dateText: { fontSize: 13, color: '#8899bb', marginBottom: 20 },
  promptText: { fontSize: 14, color: '#aab4cc', marginBottom: 14 },
  clockBtns: { width: '100%', gap: 10 },
  officeBtn: { backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  officeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  meetBtn: { backgroundColor: 'rgba(212,168,67,0.15)', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)' },
  meetBtnText: { color: COLORS.amber, fontSize: 15, fontWeight: '700' },
  clockedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clockedIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.greenLight + '33', alignItems: 'center', justifyContent: 'center' },
  clockedText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  clockedSub: { fontSize: 12, color: '#8899bb', marginTop: 2 },
  histTitle: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6, marginBottom: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  histTitle2: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  histMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  checkBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.muted, marginBottom: 16, lineHeight: 20 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  leadAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.redLight, alignItems: 'center', justifyContent: 'center' },
  leadAvatarText: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  leadRowName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  leadRowMeta: { fontSize: 11, color: COLORS.muted },
});
