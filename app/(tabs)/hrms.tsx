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
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle } from '../../components/ui';
import { THEME } from '../../lib/prowinTheme';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';

const EMPLOYEE_SELECT_COLUMNS =
  'id,employee_id,full_name,mobile,email,emergency_contact,department,designation,role,joining_date,employment_type,status';

const ATTENDANCE_SELECT_COLUMNS =
  'id,employee_name,date,check_in,check_out,status,notes,created_at';

const LEAVE_SELECT_COLUMNS =
  'id,employee_id,employee_name,leave_type,start_date,end_date,days,reason,status,approved_by_id,approved_by_name,approver_notes,created_at';

const LEAVE_TYPES = ['Annual', 'Sick', 'Unpaid', 'Emergency', 'Maternity'] as const;

type HrmsSubTab = 'employees' | 'attendance' | 'leave' | 'more';

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

type LeaveRecord = {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  leave_type: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  reason: string | null;
  status: string | null;
  approved_by_id: string | null;
  approved_by_name: string | null;
  approver_notes: string | null;
  created_at: string | null;
};

const SUB_TABS: { key: HrmsSubTab; label: string }[] = [
  { key: 'employees', label: 'Employees' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'more', label: 'More' },
];

const MORE_SECTIONS = [
  'Payroll',
  'Payslips',
  'Visa Documents',
  'Performance',
  'Training',
] as const;

function canReviewLeave(role: string | null | undefined): boolean {
  return role === 'hr_manager' || role === 'admin' || role === 'super_admin';
}

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

function inclusiveLeaveDays(start: Date, end: Date): number {
  return differenceInCalendarDays(end, start) + 1;
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

function getLeaveStatusStyle(status: string | null | undefined) {
  const label = status?.trim() || 'Pending';
  const normalized = label.toLowerCase();
  if (normalized === 'approved') {
    return { label, bg: THEME.greenFill, border: THEME.greenBorder, text: THEME.green };
  }
  if (normalized === 'rejected') {
    return { label, bg: '#fee2e2', border: '#fecaca', text: COLORS.red };
  }
  return { label, bg: THEME.amberFill, border: '#f5d9a8', text: THEME.amber };
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

function LeaveCard({ record }: { record: LeaveRecord }) {
  const statusStyle = getLeaveStatusStyle(record.status);
  const range = `${formatDateValue(record.start_date)} → ${formatDateValue(record.end_date)}`;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardMain}>
          <Text style={s.cardName} numberOfLines={1}>
            {record.leave_type?.trim() || 'Leave'}
          </Text>
          <Text style={s.cardSubtitle} numberOfLines={1}>
            {range}
          </Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {record.days != null ? `${record.days} day${Number(record.days) === 1 ? '' : 's'}` : '—'}
          </Text>
          {record.approver_notes?.trim() ? (
            <Text style={s.cardNotes} numberOfLines={2}>
              Note: {record.approver_notes}
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

function PendingLeaveCard({
  record,
  onApprove,
  onReject,
  busy,
}: {
  record: LeaveRecord;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const range = `${formatDateValue(record.start_date)} → ${formatDateValue(record.end_date)}`;

  return (
    <View style={s.card}>
      <Text style={s.cardName} numberOfLines={1}>
        {record.employee_name?.trim() || 'Unknown'}
      </Text>
      <Text style={s.cardSubtitle} numberOfLines={1}>
        {record.leave_type?.trim() || 'Leave'} · {range}
      </Text>
      <Text style={s.cardMeta} numberOfLines={1}>
        {record.days != null ? `${record.days} day${Number(record.days) === 1 ? '' : 's'}` : '—'}
      </Text>
      {record.reason?.trim() ? (
        <Text style={s.cardNotes} numberOfLines={3}>
          {record.reason}
        </Text>
      ) : null}
      <View style={s.reviewActions}>
        <TouchableOpacity
          style={[s.approveBtn, busy && s.btnDisabled]}
          onPress={onApprove}
          disabled={busy}
        >
          <Text style={s.approveBtnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.rejectBtn, busy && s.btnDisabled]}
          onPress={onReject}
          disabled={busy}
        >
          <Text style={s.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HrmsScreen() {
  const { user, role } = useCrmSession();
  const [activeSubTab, setActiveSubTab] = useState<HrmsSubTab>('employees');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesRefreshing, setEmployeesRefreshing] = useState(false);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceRefreshing, setAttendanceRefreshing] = useState(false);

  const [myLeaves, setMyLeaves] = useState<LeaveRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRecord[]>([]);
  const [leaveLoaded, setLeaveLoaded] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveRefreshing, setLeaveRefreshing] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const [requestModal, setRequestModal] = useState(false);
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>('Annual');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveSaveError, setLeaveSaveError] = useState<string | null>(null);

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

  const fetchMyLeaves = useCallback(async () => {
    if (!user?.id) {
      setMyLeaves([]);
      return;
    }

    const { data, error } = await supabase
      .from('leaves')
      .select(LEAVE_SELECT_COLUMNS)
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMyLeaves((data ?? []) as LeaveRecord[]);
  }, [user?.id]);

  const fetchPendingLeaves = useCallback(async () => {
    if (!canReviewLeave(role)) {
      setPendingLeaves([]);
      return;
    }

    const { data, error } = await supabase
      .from('leaves')
      .select(LEAVE_SELECT_COLUMNS)
      .eq('status', 'Pending')
      .order('created_at', { ascending: true });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setPendingLeaves((data ?? []) as LeaveRecord[]);
  }, [role]);

  const fetchLeaveData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setLeaveRefreshing(true);
    } else {
      setLeaveLoading(true);
    }

    await Promise.all([fetchMyLeaves(), fetchPendingLeaves()]);

    if (isRefresh) {
      setLeaveRefreshing(false);
    } else {
      setLeaveLoading(false);
    }
    setLeaveLoaded(true);
  }, [fetchMyLeaves, fetchPendingLeaves]);

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

  useEffect(() => {
    if (activeSubTab === 'leave' && !leaveLoaded && !leaveLoading) {
      void fetchLeaveData(false);
    }
  }, [activeSubTab, leaveLoaded, leaveLoading, fetchLeaveData]);

  const onRefreshEmployees = useCallback(async () => {
    await fetchEmployees(true);
  }, [fetchEmployees]);

  const onRefreshAttendance = useCallback(async () => {
    await fetchAttendance(true);
  }, [fetchAttendance]);

  const onRefreshLeave = useCallback(async () => {
    await fetchLeaveData(true);
  }, [fetchLeaveData]);

  const resetLeaveForm = useCallback(() => {
    setLeaveType('Annual');
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
    setEndDate(d);
    setLeaveReason('');
    setLeaveSaveError(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
  }, []);

  const saveLeaveRequest = useCallback(async () => {
    if (!user?.id) {
      setLeaveSaveError('You must be signed in to request leave.');
      return;
    }
    if (!leaveType) {
      setLeaveSaveError('Leave type is required.');
      return;
    }
    if (endDate < startDate) {
      setLeaveSaveError('End date must be on or after start date.');
      return;
    }

    setSavingLeave(true);
    setLeaveSaveError(null);

    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    const days = inclusiveLeaveDays(startDate, endDate);
    const reason = leaveReason.trim() || null;

    const { error } = await supabase.from('leaves').insert({
      employee_id: user.id,
      employee_name: getUserDisplayName(user),
      leave_type: leaveType,
      start_date: start,
      end_date: end,
      days,
      reason,
      status: 'Pending',
      approved_by_id: null,
      approved_by_name: null,
      approver_notes: null,
    });

    setSavingLeave(false);

    if (error) {
      setLeaveSaveError(error.message);
      return;
    }

    setRequestModal(false);
    resetLeaveForm();
    await fetchLeaveData(true);
    Alert.alert('Success', 'Leave request submitted.');
  }, [user, leaveType, startDate, endDate, leaveReason, resetLeaveForm, fetchLeaveData]);

  const reviewLeave = useCallback(async (leaveId: string, nextStatus: 'Approved' | 'Rejected') => {
    if (!canReviewLeave(role)) {
      Alert.alert('Not allowed', 'You do not have permission to review leave requests.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }

    setReviewBusyId(leaveId);
    const { error } = await supabase
      .from('leaves')
      .update({
        status: nextStatus,
        approved_by_id: user.id,
        approved_by_name: getUserDisplayName(user),
        approver_notes: null,
      })
      .eq('id', leaveId);

    setReviewBusyId(null);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await Promise.all([fetchMyLeaves(), fetchPendingLeaves()]);
  }, [role, user, fetchMyLeaves, fetchPendingLeaves]);

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

  const renderLeave = () => {
    if (leaveLoading && !leaveLoaded) {
      return <ActivityIndicator color={COLORS.red} style={s.loader} />;
    }

    const showReview = canReviewLeave(role);

    return (
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={leaveRefreshing}
            onRefresh={() => void onRefreshLeave()}
            tintColor={COLORS.red}
          />
        }
      >
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionHeader}>MY LEAVE</Text>
          <TouchableOpacity
            style={s.requestBtn}
            onPress={() => {
              resetLeaveForm();
              setRequestModal(true);
            }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.requestBtnText}>Request Leave</Text>
          </TouchableOpacity>
        </View>

        {myLeaves.length === 0 ? (
          <View style={s.emptyCompact}>
            <Ionicons name="airplane-outline" size={40} color={COLORS.muted} />
            <Text style={s.emptyText}>No leave requests yet</Text>
          </View>
        ) : (
          myLeaves.map((item) => <LeaveCard key={item.id} record={item} />)
        )}

        {showReview && (
          <>
            <Text style={[s.sectionHeader, { marginTop: 18 }]}>REQUESTS TO REVIEW</Text>
            {pendingLeaves.length === 0 ? (
              <View style={s.emptyCompact}>
                <Ionicons name="checkmark-done-outline" size={40} color={COLORS.muted} />
                <Text style={s.emptyText}>No pending requests</Text>
              </View>
            ) : (
              pendingLeaves.map((item) => (
                <PendingLeaveCard
                  key={item.id}
                  record={item}
                  busy={reviewBusyId === item.id}
                  onApprove={() => void reviewLeave(item.id, 'Approved')}
                  onReject={() => void reviewLeave(item.id, 'Rejected')}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
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

  const modalMaxHeight = Dimensions.get('window').height * 0.9;

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
        {activeSubTab === 'leave' && renderLeave()}
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

      <Modal
        visible={requestModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setRequestModal(false);
          resetLeaveForm();
        }}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalSheet, { maxHeight: modalMaxHeight }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Request Leave</Text>
              <TouchableOpacity
                onPress={() => {
                  setRequestModal(false);
                  resetLeaveForm();
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.requestModalBody}
              contentContainerStyle={s.requestModalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.fieldLabel}>LEAVE TYPE *</Text>
              <View style={s.typeWrap}>
                {LEAVE_TYPES.map((type) => {
                  const selected = leaveType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[s.typeChip, selected && s.typeChipOn]}
                      onPress={() => setLeaveType(type)}
                    >
                      <Text style={[s.typeChipText, selected && s.typeChipTextOn]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>START DATE *</Text>
              <TouchableOpacity style={s.input} onPress={() => setShowStartPicker(true)}>
                <Text style={s.pickerText}>{format(startDate, 'EEE d MMM yyyy')}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowStartPicker(Platform.OS === 'ios');
                    if (d) {
                      const next = new Date(d);
                      next.setHours(0, 0, 0, 0);
                      setStartDate(next);
                      if (endDate < next) setEndDate(next);
                    }
                  }}
                />
              )}

              <Text style={s.fieldLabel}>END DATE *</Text>
              <TouchableOpacity style={s.input} onPress={() => setShowEndPicker(true)}>
                <Text style={s.pickerText}>{format(endDate, 'EEE d MMM yyyy')}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowEndPicker(Platform.OS === 'ios');
                    if (d) {
                      const next = new Date(d);
                      next.setHours(0, 0, 0, 0);
                      setEndDate(next);
                    }
                  }}
                />
              )}

              <Text style={s.daysHint}>
                Days: {inclusiveLeaveDays(startDate, endDate)}
              </Text>

              <Text style={s.fieldLabel}>REASON</Text>
              <TextInput
                style={[s.input, s.reasonInput]}
                placeholder="Optional reason"
                placeholderTextColor={COLORS.muted}
                value={leaveReason}
                onChangeText={setLeaveReason}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            {leaveSaveError ? <Text style={s.errorText}>{leaveSaveError}</Text> : null}

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  setRequestModal(false);
                  resetLeaveForm();
                }}
                disabled={savingLeave}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, savingLeave && s.btnDisabled]}
                onPress={() => void saveLeaveRequest()}
                disabled={savingLeave}
              >
                {savingLeave ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  emptyCompact: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText: { fontSize: 15, color: COLORS.muted },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  requestBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: {
    flex: 1,
    backgroundColor: THEME.green,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectBtnText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
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
  requestModalBody: { flexGrow: 0 },
  requestModalBodyContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 10,
  },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  typeChipOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  typeChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  typeChipTextOn: { color: '#fff' },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pickerText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  daysHint: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginTop: 8 },
  reasonInput: { minHeight: 90, paddingTop: 11, fontSize: 14, color: COLORS.text },
  errorText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.red,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
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
