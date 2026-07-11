import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle } from '../../components/ui';
import { THEME } from '../../lib/prowinTheme';

const EMPLOYEE_SELECT_COLUMNS =
  'id,employee_id,full_name,mobile,email,emergency_contact,department,designation,role,joining_date,employment_type,status';

const ATTENDANCE_SELECT_COLUMNS =
  'id,employee_name,date,check_in,check_out,status,notes,created_at';

type HrmsSubTab = 'employees' | 'attendance' | 'more';

type EmployeeRecord = {
  id: string;
  employee_id: string;
  full_name: string;
  mobile: string | null;
  email: string | null;
  emergency_contact: string | null;
  department: string | null;
  designation: string | null;
  role: string | null;
  joining_date: string | null;
  employment_type: string | null;
  status: string | null;
};

type AttendanceRecord = {
  id: string;
  employee_name: string | null;
  date: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

const SUB_TABS: { key: HrmsSubTab; label: string }[] = [
  { key: 'employees', label: 'Employees' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'more', label: 'More' },
];

const MORE_SECTIONS = [
  'Leave Management',
  'Payroll',
  'Payslips',
  'Visa Documents',
  'Performance',
  'Training',
] as const;

function formatDateValue(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  try {
    const parsed = parseISO(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'd MMM yyyy');
  } catch {
    return value;
  }
}

function formatTimeValue(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'HH:mm');
  } catch {
    return value;
  }
}

function getEmployeeStatusStyle(status: string | null | undefined) {
  const label = status?.trim() || 'Unknown';
  const normalized = label.toLowerCase();
  if (normalized === 'active') {
    return { label, bg: THEME.greenFill, border: THEME.greenBorder, text: THEME.green };
  }
  if (normalized === 'terminated') {
    return { label, bg: '#f3f4f6', border: '#d1d5db', text: COLORS.muted };
  }
  return { label, bg: '#f3f4f6', border: THEME.border, text: COLORS.muted };
}

function getAttendanceStatusStyle(status: string | null | undefined) {
  const label = status?.trim() || 'Unknown';
  const normalized = label.toLowerCase();
  if (normalized === 'present') {
    return { label, bg: THEME.greenFill, border: THEME.greenBorder, text: THEME.green };
  }
  if (normalized === 'meeting') {
    return { label, bg: THEME.blueFill, border: '#c3daf5', text: THEME.blue };
  }
  return { label, bg: '#f3f4f6', border: THEME.border, text: COLORS.muted };
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value?.trim() ? value : '—'}</Text>
    </View>
  );
}

function EmployeeCard({
  employee,
  onPress,
}: {
  employee: EmployeeRecord;
  onPress: () => void;
}) {
  const subtitle = employee.designation?.trim() || employee.role?.trim() || '—';
  const statusStyle = getEmployeeStatusStyle(employee.status);

  return (
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={onPress}>
      <View style={s.cardTop}>
        <View style={s.cardMain}>
          <Text style={s.cardName} numberOfLines={1}>
            {employee.full_name}
          </Text>
          <Text style={s.cardSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          {employee.department?.trim() ? (
            <Text style={s.cardMeta} numberOfLines={1}>
              {employee.department}
            </Text>
          ) : null}
          <Text style={s.cardMeta} numberOfLines={1}>
            ID: {employee.employee_id}
          </Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
          <Text style={[s.statusPillText, { color: statusStyle.text }]} numberOfLines={1}>
            {statusStyle.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function AttendanceCard({ record }: { record: AttendanceRecord }) {
  const statusStyle = getAttendanceStatusStyle(record.status);
  const checkIn = formatTimeValue(record.check_in);
  const checkOut = record.check_out?.trim() ? formatTimeValue(record.check_out) : '—';

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardMain}>
          <Text style={s.cardName} numberOfLines={1}>
            {record.employee_name?.trim() || 'Unknown employee'}
          </Text>
          <Text style={s.cardSubtitle} numberOfLines={1}>
            {formatDateValue(record.date)}
          </Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {checkIn} → {checkOut}
          </Text>
          {record.notes?.trim() ? (
            <Text style={s.cardNotes} numberOfLines={2}>
              {record.notes}
            </Text>
          ) : null}
        </View>
        <View style={[s.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
          <Text style={[s.statusPillText, { color: statusStyle.text }]} numberOfLines={1}>
            {statusStyle.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function HrmsScreen() {
  const [activeSubTab, setActiveSubTab] = useState<HrmsSubTab>('employees');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesRefreshing, setEmployeesRefreshing] = useState(false);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceRefreshing, setAttendanceRefreshing] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);

  const fetchEmployees = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setEmployeesRefreshing(true);
    } else {
      setEmployeesLoading(true);
    }

    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_SELECT_COLUMNS)
      .order('full_name', { ascending: true });

    if (isRefresh) {
      setEmployeesRefreshing(false);
    } else {
      setEmployeesLoading(false);
    }

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setEmployees((data ?? []) as EmployeeRecord[]);
    setEmployeesLoaded(true);
  }, []);

  const fetchAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setAttendanceRefreshing(true);
    } else {
      setAttendanceLoading(true);
    }

    const { data, error } = await supabase
      .from('attendance')
      .select(ATTENDANCE_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(100);

    if (isRefresh) {
      setAttendanceRefreshing(false);
    } else {
      setAttendanceLoading(false);
    }

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setAttendance((data ?? []) as AttendanceRecord[]);
    setAttendanceLoaded(true);
  }, []);

  useEffect(() => {
    if (activeSubTab === 'employees' && !employeesLoaded && !employeesLoading) {
      void fetchEmployees(false);
    }
  }, [activeSubTab, employeesLoaded, employeesLoading, fetchEmployees]);

  useEffect(() => {
    if (activeSubTab === 'attendance' && !attendanceLoaded && !attendanceLoading) {
      void fetchAttendance(false);
    }
  }, [activeSubTab, attendanceLoaded, attendanceLoading, fetchAttendance]);

  const onRefreshEmployees = useCallback(async () => {
    await fetchEmployees(true);
  }, [fetchEmployees]);

  const onRefreshAttendance = useCallback(async () => {
    await fetchAttendance(true);
  }, [fetchAttendance]);

  const renderEmployees = () => {
    if (employeesLoading && !employeesLoaded) {
      return <ActivityIndicator color={COLORS.red} style={s.loader} />;
    }

    return (
      <FlatList
        data={employees}
        keyExtractor={(item) => item.id}
        style={s.list}
        contentContainerStyle={employees.length === 0 ? s.listEmptyContent : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={employeesRefreshing}
            onRefresh={() => void onRefreshEmployees()}
            tintColor={COLORS.red}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.muted} />
            <Text style={s.emptyText}>No employees yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EmployeeCard employee={item} onPress={() => setSelectedEmployee(item)} />
        )}
      />
    );
  };

  const renderAttendance = () => {
    if (attendanceLoading && !attendanceLoaded) {
      return <ActivityIndicator color={COLORS.red} style={s.loader} />;
    }

    return (
      <FlatList
        data={attendance}
        keyExtractor={(item) => item.id}
        style={s.list}
        contentContainerStyle={attendance.length === 0 ? s.listEmptyContent : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={attendanceRefreshing}
            onRefresh={() => void onRefreshAttendance()}
            tintColor={COLORS.red}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.muted} />
            <Text style={s.emptyText}>No attendance records yet</Text>
          </View>
        }
        renderItem={({ item }) => <AttendanceCard record={item} />}
      />
    );
  };

  const renderMore = () => (
    <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      {MORE_SECTIONS.map((section) => (
        <View key={section} style={s.moreCard}>
          <Text style={s.moreTitle}>{section}</Text>
          <View style={s.comingSoonPill}>
            <Text style={s.comingSoonText}>Coming soon</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View style={s.container}>
      <ProwinHeader />
      <PageTitle label="HRMS" title="People & attendance" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.subTabsScroll}
        contentContainerStyle={s.subTabs}
      >
        {SUB_TABS.map((tab) => {
          const active = activeSubTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.subTabPill, active && s.subTabPillOn]}
              onPress={() => setActiveSubTab(tab.key)}
            >
              <Text style={[s.subTabText, active && s.subTabTextOn]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.content}>
        {activeSubTab === 'employees' && renderEmployees()}
        {activeSubTab === 'attendance' && renderAttendance()}
        {activeSubTab === 'more' && renderMore()}
      </View>

      <Modal
        visible={selectedEmployee != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedEmployee(null)}
      >
        {selectedEmployee ? (
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedEmployee.full_name}</Text>
              <TouchableOpacity onPress={() => setSelectedEmployee(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} contentContainerStyle={s.modalBodyContent}>
              <InfoRow label="EMPLOYEE ID" value={selectedEmployee.employee_id} />
              <InfoRow label="DESIGNATION" value={selectedEmployee.designation} />
              <InfoRow label="DEPARTMENT" value={selectedEmployee.department} />
              <InfoRow label="ROLE" value={selectedEmployee.role} />
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>MOBILE</Text>
                {selectedEmployee.mobile?.trim() ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${selectedEmployee.mobile!.trim()}`)}
                  >
                    <Text style={s.detailLink}>{selectedEmployee.mobile}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={s.detailValue}>—</Text>
                )}
              </View>
              <InfoRow label="EMAIL" value={selectedEmployee.email} />
              <InfoRow label="EMERGENCY CONTACT" value={selectedEmployee.emergency_contact} />
              <InfoRow label="JOINING DATE" value={formatDateValue(selectedEmployee.joining_date)} />
              <InfoRow label="EMPLOYMENT TYPE" value={selectedEmployee.employment_type} />
              <InfoRow label="STATUS" value={selectedEmployee.status} />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  subTabsScroll: { flexGrow: 0, marginTop: 4 },
  subTabs: { paddingHorizontal: 14, gap: 8, paddingBottom: 8 },
  subTabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  subTabPillOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  subTabText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  subTabTextOn: { color: '#fff' },
  content: { flex: 1 },
  loader: { marginTop: 40 },
  list: { flex: 1, paddingHorizontal: 14 },
  listContent: { paddingBottom: 24, paddingTop: 8 },
  listEmptyContent: { flexGrow: 1, paddingBottom: 24, paddingTop: 8 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.muted },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: THEME.border,
    borderLeftWidth: 3,
    borderLeftColor: THEME.blue,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMain: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '800', color: THEME.heading },
  cardSubtitle: { fontSize: 12, color: THEME.meta, marginTop: 3 },
  cardMeta: { fontSize: 12, color: COLORS.muted, marginTop: 3 },
  cardNotes: { fontSize: 12, color: THEME.heading, marginTop: 6, lineHeight: 17 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '42%',
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  moreCard: {
    backgroundColor: THEME.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  moreTitle: { fontSize: 14, fontWeight: '700', color: THEME.heading, flex: 1 },
  comingSoonPill: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  comingSoonText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 12 },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 18, gap: 12 },
  detailRow: { gap: 4 },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
  },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  detailLink: { fontSize: 14, fontWeight: '600', color: COLORS.red },
});
