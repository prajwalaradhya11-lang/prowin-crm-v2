import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle, Card, SectionHeader, RedButton } from '../../components/ui';
import { scheduleTaskReminder, cancelTaskReminder } from '../../lib/notifications';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

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

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  // new task form
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('task');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('10:00');
  const [linkedLead, setLinkedLead] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, due_date, type, status, lead_id, lead_name')
      .order('due_date');
    if (data) setTasks(data);
  }

  async function fetchLeads() {
    const { data } = await supabase.from('leads').select('id, name').order('name');
    if (data) setLeads(data);
  }

  useEffect(() => { fetchTasks(); fetchLeads(); }, []);
  const onRefresh = async () => { setRefreshing(true); await fetchTasks(); setRefreshing(false); };

  function getFiltered() {
    let result = tasks;
    if (filter === 'Today') result = result.filter(t => t.due_date && isToday(parseISO(t.due_date)));
    else if (filter === 'Meetings') result = result.filter(t => t.type === 'meeting');
    else if (filter === 'Events') result = result.filter(t => t.type === 'event');
    else if (filter === 'Holidays') return UAE_HOLIDAYS_2026.map(h => ({ ...h, type: 'holiday', status: 'holiday', id: h.date }));
    return result;
  }

  async function toggleDone(task: any) {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    if (newStatus === 'done') await cancelTaskReminder(task.id);
    fetchTasks();
  }

  async function saveTask() {
    if (!title || !dueDate) { Alert.alert('Enter title and due date'); return; }
    setSaving(true);
    const fullDue = `${dueDate}T${dueTime}:00`;
    const lead = leads.find(l => l.id === linkedLead);

    const { data, error } = await supabase.from('tasks').insert({
      title,
      type: taskType,
      due_date: fullDue,
      status: 'pending',
      lead_id: linkedLead || null,
      lead_name: lead?.name ?? null,
    }).select().single();

    if (!error && data) {
      await scheduleTaskReminder(data.id, title, new Date(fullDue), 30);
    }
    setSaving(false);
    setAddModal(false);
    resetForm();
    fetchTasks();
  }

  function resetForm() { setTitle(''); setTaskType('task'); setDueDate(''); setDueTime('10:00'); setLinkedLead(''); }

  function getTaskIcon(type: string, status: string) {
    if (type === 'holiday') return { name: 'sunny-outline', color: COLORS.amber };
    if (type === 'meeting') return { name: 'location-outline', color: COLORS.amber };
    if (type === 'event') return { name: 'calendar-outline', color: COLORS.blue };
    if (status === 'done') return { name: 'checkmark-circle', color: COLORS.green };
    return { name: 'checkbox-outline', color: COLORS.red };
  }

  function getTaskBorderColor(task: any) {
    if (task.type === 'holiday') return COLORS.amber;
    if (task.type === 'meeting') return COLORS.amber;
    if (task.type === 'event') return COLORS.blue;
    if (task.status === 'done') return COLORS.green;
    if (task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done') return COLORS.red;
    return COLORS.blue;
  }

  function formatDue(dateStr: string) {
    if (!dateStr) return '';
    const d = parseISO(dateStr);
    if (isToday(d)) return `Today · ${format(d, 'HH:mm')}`;
    if (isTomorrow(d)) return `Tomorrow · ${format(d, 'HH:mm')}`;
    return format(d, 'EEE d MMM · HH:mm');
  }

  const filtered = getFiltered();

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
        <SectionHeader title={format(new Date(), 'EEEE, d MMMM yyyy')} />

        {filtered.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="checkbox-outline" size={44} color={COLORS.muted} />
            <Text style={s.emptyText}>No tasks here</Text>
          </View>
        )}

        {filtered.map((task: any) => {
          const icon = getTaskIcon(task.type, task.status);
          const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done' && task.type !== 'holiday';

          return (
            <Card key={task.id} topColor={getTaskBorderColor(task)} style={task.status === 'done' ? { opacity: 0.6 } : {}}>
              <View style={s.taskRow}>
                {task.type !== 'holiday' && (
                  <TouchableOpacity onPress={() => toggleDone(task)} style={s.checkWrap}>
                    <View style={[s.check, task.status === 'done' && s.checkDone, isOverdue && s.checkOver]}>
                      {task.status === 'done' && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                )}
                {task.type === 'holiday' && (
                  <View style={s.holidayIcon}>
                    <Ionicons name="sunny-outline" size={18} color={COLORS.amber} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.taskTitle, task.status === 'done' && s.taskDone]}>{task.title}</Text>
                  <Text style={s.taskMeta}>{task.due_date ? formatDue(task.due_date) : task.date}</Text>
                  {task.lead_name && (
                    <Text style={s.taskLead}>
                      <Ionicons name="person-outline" size={11} /> {task.lead_name}
                    </Text>
                  )}
                  {isOverdue && <Text style={s.overdueText}>Overdue</Text>}
                  {task.status === 'pending' && !isOverdue && task.due_date && (
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

      {/* Add Task Modal */}
      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add task / meeting</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.fieldLabel}>TITLE</Text>
            <TextInput style={s.input} placeholder="e.g. Follow up with Sara" placeholderTextColor={COLORS.muted} value={title} onChangeText={setTitle} />

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>TYPE</Text>
            <View style={s.typeRow}>
              {['task', 'meeting', 'event'].map(t => (
                <TouchableOpacity key={t} style={[s.typeBtn, taskType === t && s.typeBtnOn]} onPress={() => setTaskType(t)}>
                  <Text style={[s.typeBtnText, taskType === t && s.typeBtnTextOn]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>DUE DATE (YYYY-MM-DD)</Text>
            <TextInput style={s.input} placeholder="2026-05-20" placeholderTextColor={COLORS.muted} value={dueDate} onChangeText={setDueDate} />

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>TIME (HH:MM)</Text>
            <TextInput style={s.input} placeholder="14:00" placeholderTextColor={COLORS.muted} value={dueTime} onChangeText={setDueTime} />

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>LINKED LEAD (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <TouchableOpacity style={[s.leadChip, !linkedLead && s.leadChipOn]} onPress={() => setLinkedLead('')}>
                <Text style={[s.leadChipText, !linkedLead && s.leadChipTextOn]}>None</Text>
              </TouchableOpacity>
              {leads.map(l => (
                <TouchableOpacity key={l.id} style={[s.leadChip, linkedLead === l.id && s.leadChipOn]} onPress={() => setLinkedLead(l.id)}>
                  <Text style={[s.leadChipText, linkedLead === l.id && s.leadChipTextOn]}>{l.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.reminderInfo}>
              <Ionicons name="notifications-outline" size={14} color={COLORS.blue} />
              <Text style={s.reminderInfoText}>A push notification will be sent 30 minutes before this task.</Text>
            </View>

            <RedButton label="Save task" onPress={saveTask} icon="checkmark-circle-outline" loading={saving} />
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
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text },
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
