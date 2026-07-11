import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { format, parseISO } from 'date-fns';
import { supabase, COLORS } from '../lib/supabase';
import { Card } from '../components/ui';
import { SafeScreenHeader } from '../components/SafeScreenHeader';
import { getName, getLeadInitials } from '../lib/leadName';
import { resolveEmployeeIdForUser } from '../lib/callLog';
import { getUserDisplayName } from '../hooks/useCrmSession';

type AttendanceRow = {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  date: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

function isMeetingRecord(rec: AttendanceRow): boolean {
  return rec.status === 'Meeting' || (rec.notes ?? '').startsWith('Meeting:');
}

function meetingLabelFromNotes(notes: string | null): string {
  if (!notes?.startsWith('Meeting:')) return 'Client meeting';
  const match = notes.match(/^Meeting:\s*([^.]+)/);
  return match?.[1]?.trim() || 'Client meeting';
}

function formatCheckInTime(rec: AttendanceRow): string {
  if (rec.check_in) {
    try {
      return format(parseISO(`2000-01-01T${rec.check_in}`), 'HH:mm');
    } catch {
      return rec.check_in.slice(0, 5);
    }
  }
  if (rec.created_at) return format(parseISO(rec.created_at), 'HH:mm');
  return '--:--';
}

export default function ClockInScreen() {
  const [loading, setLoading] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInType, setClockInType] = useState<'office' | 'meeting'>('office');
  const [clockInTime, setClockInTime] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [leadModal, setLeadModal] = useState(false);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const employee = await resolveEmployeeIdForUser(user.email, getUserDisplayName({
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.full_name ?? null,
      role: 'agent',
    }));

    if (!employee) {
      console.warn('[clock-in] No employees row matched auth user', user.email);
    } else {
      setEmployeeId(employee.id);
      setEmployeeName(employee.fullName);
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    if (employee) {
      const { data: todayRecord, error: todayErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .maybeSingle();

      if (todayErr) console.warn('[clock-in] today query error', todayErr.message);

      if (todayRecord) {
        setClockedIn(true);
        setClockInType(isMeetingRecord(todayRecord) ? 'meeting' : 'office');
        setClockInTime(formatCheckInTime(todayRecord));
      } else {
        setClockedIn(false);
        setClockInTime('');
      }

      const { data: histData, error: histErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .order('date', { ascending: false })
        .limit(7);

      if (histErr) console.warn('[clock-in] history query error', histErr.message);
      if (histData) setHistory(histData);
    }

    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, lead_name, first_name, last_name, phone, area, communities')
      .order('created_at', { ascending: false });
    if (leadsData) setLeads(leadsData);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function clockIn(type: 'office' | 'meeting', leadId?: string, leadName?: string) {
    if (!employeeId) {
      Alert.alert(
        'Cannot clock in',
        'Your account is not linked to an employee record. Ask your manager to add you in HRMS.',
      );
      return;
    }

    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let address: string | null = null;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        address = [geo.street, geo.district, geo.city].filter(Boolean).join(', ');
      }

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const checkIn = format(now, 'HH:mm:ss');

      let notes = type === 'office'
        ? (address ? `Office clock-in. Location: ${address}` : 'Office clock-in')
        : `Meeting: ${leadName ?? 'Client'}${address ? `. Location: ${address}` : ''}`;

      const payload = {
        employee_id: employeeId,
        employee_name: employeeName || null,
        date: today,
        check_in: checkIn,
        status: type === 'office' ? 'Present' : 'Meeting',
        notes,
      };

      const { data, error } = await supabase
        .from('attendance')
        .insert(payload)
        .select()
        .single();

      console.log('[clock-in] insert response', { data, error: error?.message });

      if (error) {
        Alert.alert('Clock-in failed', error.message);
        return;
      }

      setClockedIn(true);
      setClockInType(type);
      setClockInTime(format(now, 'HH:mm'));
      setLeadModal(false);
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not clock in. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  function handleOffice() { clockIn('office'); }
  function handleMeeting() { setLeadModal(true); }

  return (
    <View style={s.container}>
      <SafeScreenHeader
        title="Attendance"
        onBack={() => router.back()}
        leftContent={
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-down" size={24} color={COLORS.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
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
                <Text style={s.clockedSub}>
                  Clocked in today at {clockInTime || format(new Date(), 'HH:mm')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {history.length > 0 && (
          <>
            <Text style={s.histTitle}>RECENT</Text>
            {history.map((rec) => {
              const meeting = isMeetingRecord(rec);
              return (
                <Card key={rec.id} topColor={meeting ? COLORS.amber : COLORS.green} style={{ paddingVertical: 11 }}>
                  <View style={s.histRow}>
                    <Ionicons
                      name={meeting ? 'location-outline' : 'business-outline'}
                      size={18}
                      color={meeting ? COLORS.amber : COLORS.green}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.histTitle2}>
                        {meeting ? `Meeting — ${meetingLabelFromNotes(rec.notes)}` : 'In the office'}
                      </Text>
                      <Text style={s.histMeta}>
                        {rec.date ? format(parseISO(rec.date), 'EEE d MMM') : ''}
                        {' · '}
                        {formatCheckInTime(rec)}
                        {rec.notes && !meeting && rec.notes.includes('Location:')
                          ? ` · ${rec.notes.split('Location:')[1]?.trim()}`
                          : ''}
                      </Text>
                    </View>
                    <View style={[s.checkBadge, { backgroundColor: COLORS.greenLight }]}>
                      <Ionicons name="checkmark" size={14} color={COLORS.green} />
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={leadModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Which lead are you visiting?</Text>
            <TouchableOpacity onPress={() => setLeadModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 14 }}>
            <Text style={s.modalSub}>Your GPS location will be saved in the attendance notes.</Text>
            {leads.map(lead => {
              const displayName = getName(lead);
              const initials = getLeadInitials(lead);
              const areaLabel = lead.area ?? lead.communities;
              return (
                <TouchableOpacity
                  key={lead.id}
                  style={s.leadRow}
                  onPress={() => clockIn('meeting', lead.id, displayName)}
                  disabled={loading}
                >
                  <View style={s.leadAvatar}>
                    {initials
                      ? <Text style={s.leadAvatarText}>{initials}</Text>
                      : lead.phone?.trim()
                        ? <Ionicons name="call-outline" size={16} color={COLORS.red} />
                        : <Text style={s.leadAvatarText}>?</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.leadRowName}>{displayName}</Text>
                    {areaLabel && <Text style={s.leadRowMeta}>{areaLabel}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
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
