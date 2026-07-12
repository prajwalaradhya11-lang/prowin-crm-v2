import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, RefreshControl, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, parseISO } from 'date-fns';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle, Card, SectionHeader, RedButton } from '../../components/ui';
import { scheduleTaskReminder, cancelTaskReminder } from '../../lib/notifications';
import { getName } from '../../lib/leadName';
import { useCrmSession, getUserDisplayName } from '../../hooks/useCrmSession';
import {
  type TaskRow,
  taskDueDateTime,
  formatTaskDue,
  isTaskOverdue,
  isTaskDone,
  mapTaskTypeToDb,
  mapTaskTypeFromDb,
  normalizeDueTime,
} from '../../lib/tasks';

const FILTERS = ['All', 'Today', 'Meetings', 'Events', 'Holidays'];
const UAE_HOLIDAYS_2026 = [
  { title: 'New Year\'s Day', date: '2026-01-01' },
  { title: 'Eid Al Fitr', date: '2026-03-20' },
  { title: 'Eid Al Adha', date: '2026-06-05' },
  { title: 'Arafat Day', date: '2026-06-04' },
  { title: 'Islamic New Year', date: '2026-06-26' },
  { title: 'Prophet\'s Birthday', date: '2026-09-15' },
  { title: 'Commemoration Day', date: '2026-11-30' },
  { title: 'UAE National Day', date: '2026-12-02' },
];

const TASK_SELECT_COLUMNS =
  'id, title, description, due_date, due_time, task_type, status, visibility, related_id, related_name, assigned_to_id, assigned_to_name, assigned_by_id, assigned_by_name, created_at';

type CreateMode = 'task' | 'announcement';

function canPostAnnouncement(role: string | null | undefined): boolean {
  return (
    role === 'hr_manager'
    || role === 'recruiter'
    || role === 'admin'
    || role === 'super_admin'
  );
}

function isAnnouncementRow(task: TaskRow): boolean {
  return (task.visibility ?? '').toLowerCase() === 'announcement';
}

function formatPostedAt(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'd MMM yyyy · HH:mm');
  } catch {
    return value;
  }
}

export default function TasksScreen() {
  const { user, role } = useCrmSession();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  // new task / announcement form
  const [createMode, setCreateMode] = useState<CreateMode>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('task');
  const [dueDateObj, setDueDateObj] = useState(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [linkedLead, setLinkedLead] = useState('');
  const [saving, setSaving] = useState(false);

  const allowedToAnnounce = canPostAnnouncement(role);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([]);
      return;
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT_COLUMNS)
      .or(`assigned_to_id.eq.${user.id},assigned_by_id.eq.${user.id},visibility.eq.announcement`)
      .order('due_date', { ascending: true });

    if (error) {
      console.warn('[tasks] fetch error', error.message);
      Alert.alert('Could not load tasks', error.message);
      return;
    }
    if (data) setTasks(data as TaskRow[]);
  }, [user?.id]);

  async function fetchLeads() {
    const { data } = await supabase.from('leads').select('id, lead_name, first_name, last_name, phone').order('lead_name');
    if (data) setLeads(data);
  }

  useEffect(() => { fetchLeads(); }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks]),
  );

  const onRefresh = async () => { setRefreshing(true); await fetchTasks(); setRefreshing(false); };

  const announcements = useMemo(
    () => tasks.filter(isAnnouncementRow),
    [tasks],
  );

  function getFiltered() {
    if (filter === 'Holidays') {
      return UAE_HOLIDAYS_2026.map(h => ({ ...h, task_type: 'holiday', status: 'holiday', id: h.date }));
    }

    let result = tasks.filter(t => !isAnnouncementRow(t));
    if (filter === 'Today') {
      result = result.filter(t => {
        const d = taskDueDateTime(t);
        return d ? isToday(d) : false;
      });
    } else if (filter === 'Meetings') {
      result = result.filter(t => mapTaskTypeFromDb(t.task_type) === 'meeting');
    } else if (filter === 'Events') {
      result = result.filter(t => mapTaskTypeFromDb(t.task_type) === 'event');
    }
    return result;
  }

  async function toggleDone(task: TaskRow) {
    if (isAnnouncementRow(task)) return;
    const newStatus = isTaskDone(task) ? 'Pending' : 'Done';
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    if (error) Alert.alert('Update failed', error.message);
    if (newStatus === 'Done') await cancelTaskReminder(task.id);
    fetchTasks();
  }

  async function saveAnnouncement() {
    if (!canPostAnnouncement(role)) {
      Alert.alert('Not allowed', 'You do not have permission to post announcements.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in again to post an announcement.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Enter a title');
      return;
    }

    setSaving(true);
    const trimmedDescription = description.trim();
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      description: trimmedDescription || null,
      task_type: 'announcement',
      visibility: 'announcement',
      assigned_to_id: null,
      assigned_to_name: null,
      assigned_by_id: user.id,
      assigned_by_name: getUserDisplayName(user),
      status: 'Pending',
      due_date: null,
      due_time: null,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Could not post announcement', error.message);
      return;
    }

    setAddModal(false);
    resetForm();
    fetchTasks();
  }

  async function saveTask() {
    if (createMode === 'announcement') {
      await saveAnnouncement();
      return;
    }

    const dueDate = format(dueDateObj, 'yyyy-MM-dd');
    const dueTime = format(dueDateObj, 'HH:mm');
    if (!title || !dueDate) { Alert.alert('Enter title and due date'); return; }
    setSaving(true);

    const lead = leads.find(l => l.id === linkedLead);
    const assigneeId = user?.id ?? null;
    const assigneeName = user ? getUserDisplayName(user) : null;
    const dueTimeNorm = normalizeDueTime(dueTime);
    const dueDateTime = parseISO(`${dueDate}T${dueTimeNorm}`);

    const { data, error } = await supabase.from('tasks').insert({
      title,
      task_type: mapTaskTypeToDb(taskType),
      due_date: dueDate,
      due_time: dueTimeNorm,
      status: 'Pending',
      visibility: 'private',
      assigned_to_id: assigneeId,
      assigned_to_name: assigneeName,
      assigned_by_id: assigneeId,
      assigned_by_name: assigneeName,
      related_module: linkedLead ? 'leads' : null,
      related_id: linkedLead || null,
      related_name: lead ? getName(lead) : null,
    }).select().single();

    if (error) {
      Alert.alert('Could not save task', error.message);
      setSaving(false);
      return;
    }

    if (data) {
      await scheduleTaskReminder(data.id, title, dueDateTime, 30);
    }
    setSaving(false);
    setAddModal(false);
    resetForm();
    fetchTasks();
  }

  function resetForm() {
    setCreateMode('task');
    setTitle('');
    setDescription('');
    setTaskType('task');
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    setDueDateObj(d);
    setLinkedLead('');
  }

  function getTaskIcon(taskType: string | null, status: string | null) {
    const type = mapTaskTypeFromDb(taskType);
    if (type === 'holiday') return { name: 'sunny-outline', color: COLORS.amber };
    if (type === 'meeting') return { name: 'location-outline', color: COLORS.amber };
    if (type === 'event') return { name: 'calendar-outline', color: COLORS.blue };
    if (isTaskDone({
      id: '',
      title: '',
      description: null,
      due_date: null,
      due_time: null,
      task_type: taskType,
      status,
      visibility: null,
      related_id: null,
      related_name: null,
      assigned_to_id: null,
      assigned_to_name: null,
      assigned_by_id: null,
      assigned_by_name: null,
    })) {
      return { name: 'checkmark-circle', color: COLORS.green };
    }
    return { name: 'checkbox-outline', color: COLORS.red };
  }

  function getTaskBorderColor(task: TaskRow) {
    const type = mapTaskTypeFromDb(task.task_type);
    if (type === 'holiday') return COLORS.amber;
    if (type === 'meeting') return COLORS.amber;
    if (type === 'event') return COLORS.blue;
    if (isTaskDone(task)) return COLORS.green;
    if (isTaskOverdue(task)) return COLORS.red;
    return COLORS.blue;
  }

  const filtered = getFiltered();
  const showAnnouncements = filter === 'All' && announcements.length > 0;

  return (
    <View style={s.container}>
      <ProwinHeader
        rightContent={
          <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        }
      />
      <PageTitle label="CRM" title="Tasks & Calendar" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll} contentContainerStyle={s.pills}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.pill, filter === f && s.pillOn]} onPress={() => setFilter(f)}>
            <Text style={[s.pillText, filter === f && s.pillTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />}
      >
        {showAnnouncements && (
          <>
            <SectionHeader title="📣 Announcements" />
            {announcements.map((item) => (
              <View key={item.id} style={s.announcementCard}>
                <Text style={s.announcementTitle}>{item.title}</Text>
                {item.description?.trim() ? (
                  <Text style={s.announcementBody}>{item.description}</Text>
                ) : null}
                <Text style={s.announcementMeta}>
                  Posted by {item.assigned_by_name?.trim() || 'Unknown'}
                  {item.created_at ? ` · ${formatPostedAt(item.created_at)}` : ''}
                </Text>
              </View>
            ))}
          </>
        )}

        <SectionHeader title={format(new Date(), 'EEEE, d MMMM yyyy')} />

        {filtered.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="checkbox-outline" size={44} color={COLORS.muted} />
            <Text style={s.emptyText}>No tasks here</Text>
          </View>
        )}

        {filtered.map((task: any) => {
          const typeKey = task.task_type != null ? mapTaskTypeFromDb(task.task_type) : (task.type ?? 'task');
          const icon = getTaskIcon(task.task_type ?? null, task.status ?? null);
          const done = isTaskDone(task);
          const overdue = isTaskOverdue(task);

          return (
            <Card key={task.id} topColor={getTaskBorderColor(task)} style={done ? { opacity: 0.6 } : {}}>
              <View style={s.taskRow}>
                {typeKey !== 'holiday' && (
                  <TouchableOpacity onPress={() => toggleDone(task)} style={s.checkWrap}>
                    <View style={[s.check, done && s.checkDone, overdue && s.checkOver]}>
                      {done && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                )}
                {typeKey === 'holiday' && (
                  <View style={s.holidayIcon}>
                    <Ionicons name="sunny-outline" size={18} color={COLORS.amber} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.taskTitle, done && s.taskDone]}>{task.title}</Text>
                  <Text style={s.taskMeta}>
                    {task.due_date ? formatTaskDue(task) : task.date ? format(parseISO(task.date), 'EEE, d MMMM yyyy') : ''}
                  </Text>
                  {task.related_name && (
                    <Text style={s.taskLead}>
                      <Ionicons name="person-outline" size={11} /> {task.related_name}
                    </Text>
                  )}
                  {overdue && <Text style={s.overdueText}>Overdue</Text>}
                  {!done && !overdue && task.due_date && (
                    <Text style={s.reminderText}>
                      <Ionicons name="notifications-outline" size={11} /> Reminder 30 mins before
                    </Text>
                  )}
                </View>
                <View style={[s.typeBadge, { backgroundColor: icon.color + '20' }]}>
                  <Ionicons name={icon.name as any} size={16} color={icon.color} />
                </View>
              </View>
            </Card>
          );
        })}

        {filter === 'All' && (
          <>
            <SectionHeader title="UAE public holidays 2026" />
            {UAE_HOLIDAYS_2026.map(h => (
              <Card key={h.date} topColor={COLORS.amber} style={{ paddingVertical: 11 }}>
                <View style={s.taskRow}>
                  <View style={s.holidayIcon}><Ionicons name="sunny-outline" size={18} color={COLORS.amber} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.taskTitle}>{h.title}</Text>
                    <Text style={s.taskMeta}>{format(parseISO(h.date), 'EEE, d MMMM yyyy')}</Text>
                  </View>
                  <View style={[s.typeBadge, { backgroundColor: COLORS.amberLight }]}>
                    <Text style={{ fontSize: 10, color: COLORS.amber, fontWeight: '700' }}>Holiday</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Add Task / Announcement Modal */}
      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {createMode === 'announcement' ? 'Post announcement' : 'Add task / meeting'}
            </Text>
            <TouchableOpacity onPress={() => { setAddModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            {allowedToAnnounce && (
              <>
                <Text style={s.fieldLabel}>MODE</Text>
                <View style={s.typeRow}>
                  <TouchableOpacity
                    style={[s.typeBtn, createMode === 'task' && s.typeBtnOn]}
                    onPress={() => setCreateMode('task')}
                  >
                    <Text style={[s.typeBtnText, createMode === 'task' && s.typeBtnTextOn]}>Task</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.typeBtn, createMode === 'announcement' && s.typeBtnOn]}
                    onPress={() => setCreateMode('announcement')}
                  >
                    <Text style={[s.typeBtnText, createMode === 'announcement' && s.typeBtnTextOn]}>Announcement</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={[s.fieldLabel, allowedToAnnounce ? { marginTop: 14 } : null]}>TITLE</Text>
            <TouchableOpacity style={s.input} activeOpacity={1}>
              <TextInput
                style={s.textInputInner}
                placeholder={createMode === 'announcement' ? 'Announcement title' : 'e.g. Follow up with Sara'}
                placeholderTextColor={COLORS.muted}
                value={title}
                onChangeText={setTitle}
              />
            </TouchableOpacity>

            {createMode === 'announcement' ? (
              <>
                <Text style={[s.fieldLabel, { marginTop: 14 }]}>DESCRIPTION (optional)</Text>
                <TextInput
                  style={[s.input, s.descriptionInput]}
                  placeholder="Company-wide message"
                  placeholderTextColor={COLORS.muted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
                <View style={s.reminderInfo}>
                  <Ionicons name="megaphone-outline" size={14} color={COLORS.blue} />
                  <Text style={s.reminderInfoText}>
                    This will be visible to everyone. No personal reminder is scheduled.
                  </Text>
                </View>
                <RedButton
                  label="Post announcement"
                  onPress={saveTask}
                  icon="megaphone-outline"
                  loading={saving}
                />
              </>
            ) : (
              <>
                <Text style={[s.fieldLabel, { marginTop: 14 }]}>TYPE</Text>
                <View style={s.typeRow}>
                  {['task', 'meeting', 'event'].map(t => (
                    <TouchableOpacity key={t} style={[s.typeBtn, taskType === t && s.typeBtnOn]} onPress={() => setTaskType(t)}>
                      <Text style={[s.typeBtnText, taskType === t && s.typeBtnTextOn]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.fieldLabel, { marginTop: 14 }]}>DUE DATE</Text>
                <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)}>
                  <Text style={s.pickerText}>{format(dueDateObj, 'EEE d MMM yyyy')}</Text>
                </TouchableOpacity>

                <Text style={[s.fieldLabel, { marginTop: 14 }]}>TIME</Text>
                <TouchableOpacity style={s.input} onPress={() => setShowTimePicker(true)}>
                  <Text style={s.pickerText}>{format(dueDateObj, 'h:mm a')}</Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={dueDateObj}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, d) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (d) setDueDateObj(prev => {
                        const next = new Date(d);
                        next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                        return next;
                      });
                    }}
                  />
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={dueDateObj}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, d) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (d) setDueDateObj(d);
                    }}
                  />
                )}

                <Text style={[s.fieldLabel, { marginTop: 14 }]}>LINKED LEAD (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  <TouchableOpacity style={[s.leadChip, !linkedLead && s.leadChipOn]} onPress={() => setLinkedLead('')}>
                    <Text style={[s.leadChipText, !linkedLead && s.leadChipTextOn]}>None</Text>
                  </TouchableOpacity>
                  {leads.map(l => (
                    <TouchableOpacity key={l.id} style={[s.leadChip, linkedLead === l.id && s.leadChipOn]} onPress={() => setLinkedLead(l.id)}>
                      <Text style={[s.leadChipText, linkedLead === l.id && s.leadChipTextOn]}>{getName(l)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={s.reminderInfo}>
                  <Ionicons name="notifications-outline" size={14} color={COLORS.blue} />
                  <Text style={s.reminderInfoText}>A push notification will be sent 30 minutes before this task.</Text>
                </View>

                <RedButton label="Save task" onPress={saveTask} icon="checkmark-circle-outline" loading={saving} />
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
  pillsScroll: { flexGrow: 0, marginTop: 10 },
  pills: { paddingHorizontal: 14, gap: 6, paddingBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pillOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  pillTextOn: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 14 },
  empty: { alignItems: 'center', paddingTop: 50, gap: 10 },
  emptyText: { fontSize: 15, color: COLORS.muted },
  announcementCard: {
    backgroundColor: '#fdf2f1',
    borderWidth: 1,
    borderColor: '#f5d0cc',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  announcementTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  announcementBody: { fontSize: 13, color: COLORS.text, marginTop: 6, lineHeight: 19 },
  announcementMeta: { fontSize: 11, color: COLORS.muted, marginTop: 8, fontWeight: '600' },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkWrap: { paddingTop: 2 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  checkOver: { borderColor: COLORS.red },
  holidayIcon: { width: 20, alignItems: 'center', paddingTop: 2 },
  taskTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  taskDone: { textDecorationLine: 'line-through', color: COLORS.muted },
  taskMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  taskLead: { fontSize: 11, color: COLORS.blue, marginTop: 2 },
  overdueText: { fontSize: 11, color: COLORS.red, fontWeight: '700', marginTop: 3 },
  reminderText: { fontSize: 11, color: COLORS.green, marginTop: 3 },
  typeBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalBody: { flex: 1, padding: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12 },
  descriptionInput: { minHeight: 110, paddingTop: 12 },
  textInputInner: { fontSize: 14, color: COLORS.text, padding: 0 },
  pickerText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center' },
  typeBtnOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  typeBtnTextOn: { color: '#fff' },
  leadChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, marginRight: 8 },
  leadChipOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  leadChipText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  leadChipTextOn: { color: '#fff' },
  reminderInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.blueLight, borderRadius: 10, padding: 10, marginBottom: 16 },
  reminderInfoText: { flex: 1, fontSize: 12, color: COLORS.blue, lineHeight: 18 },
});
