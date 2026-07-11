import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, COLORS } from '../../lib/supabase';
import { SafeScreenHeader } from '../../components/SafeScreenHeader';
import { generateLeadSummary } from '../../lib/ai';
import { fetchActiveStatusOptions, fetchActiveReasonOptions } from '../../lib/leadStatus';

const SOURCES = ['Meta', 'Google', 'Property Finder', 'Bayut', 'Dubizzle', 'Referral', 'Walk-in', 'Cold Call', 'WhatsApp', 'Snapchat', 'TikTok', 'Other'];
const STAGES = ['Fresh', 'Attempted', 'Connected', 'Qualified', 'Visit Scheduled', 'Visit Done', 'Offer Made', 'Won', 'Lost'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Hot'];
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Office', 'Shop', 'Warehouse', 'Plot', 'Penthouse'];
const BEDROOMS = ['Studio', '1 BR', '2 BR', '3 BR', '4 BR', '5 BR', '6+ BR'];
const PURPOSES = ['Buy', 'Rent', 'Invest'];
const TIMELINES = ['Immediately', '1-3 months', '3-6 months', '6-12 months', '1 year+'];
const NATIONALITIES = ['UAE', 'Indian', 'British', 'Russian', 'Chinese', 'Pakistani', 'Egyptian', 'Saudi', 'Kuwaiti', 'Other'];

export default function AddLeadScreen() {
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [agentModal, setAgentModal] = useState(false);
  const [statusOptions, setStatusOptions] = useState<string[]>(['New']);
  const [reasonOptions, setReasonOptions] = useState<string[]>([]);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    nationality: '',
    lead_source: '',
    sub_source: '',
    campaign_name: '',
    property_type: '',
    bedrooms: '',
    communities: '',
    min_budget: '',
    max_budget: '',
    purpose: '',
    timeline: '',
    assigned_agent_name: '',
    assigned_agent_id: '',
    lead_status: 'New',
    status_reason: '',
    lead_stage: 'Fresh',
    priority: 'Medium',
    remarks: '',
    next_action: '',
  });

  useEffect(() => {
    loadAgents();
    loadStatusOptions();
  }, []);

  async function loadStatusOptions() {
    const [statuses, reasons] = await Promise.all([
      fetchActiveStatusOptions(),
      fetchActiveReasonOptions(),
    ]);
    if (statuses.length) setStatusOptions(statuses.map(o => o.name));
    if (reasons.length) setReasonOptions(reasons.map(o => o.name));
  }

  async function loadAgents() {
    const { data } = await supabase.from('employees').select('id, full_name').eq('status', 'active').order('full_name');
    if (data) setAgents(data);
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function saveLead() {
    if (!form.first_name.trim()) { Alert.alert('Required', 'Please enter the lead name'); return; }
    if (!form.phone.trim()) { Alert.alert('Required', 'Please enter a phone number'); return; }

    setLoading(true);
    try {
      // Get next lead number
      const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      const leadNumber = `LP${String((count ?? 0) + 1).padStart(3, '0')}`;

      // Generate AI summary
      const aiSummary = await generateLeadSummary({
        name: `${form.first_name} ${form.last_name}`,
        property_type: form.property_type,
        area: form.communities,
        budget: form.min_budget && form.max_budget ? `${form.min_budget}-${form.max_budget}` : form.max_budget,
        source: form.lead_source,
        notes: form.remarks,
      });

      const { error } = await supabase.from('leads').insert({
        lead_number: leadNumber,
        first_name: form.first_name,
        last_name: form.last_name,
        lead_name: `${form.first_name} ${form.last_name}`,
        phone: form.phone,
        whatsapp: form.whatsapp || form.phone,
        email: form.email,
        nationality: form.nationality,
        lead_source: form.lead_source,
        source: form.lead_source,
        sub_source: form.sub_source,
        campaign_name: form.campaign_name,
        property_type: form.property_type,
        bedrooms: form.bedrooms,
        communities: form.communities,
        area: form.communities,
        min_budget: form.min_budget ? parseFloat(form.min_budget) : null,
        max_budget: form.max_budget ? parseFloat(form.max_budget) : null,
        budget: form.max_budget,
        purpose: form.purpose,
        timeline: form.timeline,
        assigned_agent_name: form.assigned_agent_name,
        assigned_agent_id: form.assigned_agent_id || null,
        lead_status: form.lead_status,
        status: form.lead_status,
        status_reason: form.status_reason || null,
        lead_stage: form.lead_stage,
        priority: form.priority,
        remarks: form.remarks,
        notes: form.remarks,
        next_action: form.next_action,
        ai_summary: aiSummary,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      Alert.alert('Success', 'Lead added successfully!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save lead');
    }
    setLoading(false);
  }

  function PickerRow({ label, value, options, field }: { label: string; value: string; options: string[]; field: string }) {
    const [open, setOpen] = useState(false);
    return (
      <View style={s.fieldWrap}>
        <Text style={s.label}>{label}</Text>
        <TouchableOpacity style={s.picker} onPress={() => setOpen(true)}>
          <Text style={[s.pickerText, !value && { color: COLORS.muted }]}>{value || `Select ${label}`}</Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.muted} />
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="slide">
          <TouchableOpacity style={s.overlay} onPress={() => setOpen(false)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{label}</Text>
            <ScrollView>
              {options.map(opt => (
                <TouchableOpacity key={opt} style={[s.sheetItem, value === opt && s.sheetItemActive]} onPress={() => { set(field, opt); setOpen(false); }}>
                  <Text style={[s.sheetItemText, value === opt && s.sheetItemTextActive]}>{opt}</Text>
                  {value === opt && <Ionicons name="checkmark" size={16} color={COLORS.red} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeScreenHeader title="Add New Lead" onBack={() => router.back()} />

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Basic Info */}
        <Text style={s.section}>BASIC INFORMATION</Text>
        <View style={s.row}>
          <View style={[s.fieldWrap, { flex: 1 }]}>
            <Text style={s.label}>First Name *</Text>
            <TextInput style={s.input} value={form.first_name} onChangeText={v => set('first_name', v)} placeholder="First name" placeholderTextColor={COLORS.muted} />
          </View>
          <View style={{ width: 10 }} />
          <View style={[s.fieldWrap, { flex: 1 }]}>
            <Text style={s.label}>Last Name</Text>
            <TextInput style={s.input} value={form.last_name} onChangeText={v => set('last_name', v)} placeholder="Last name" placeholderTextColor={COLORS.muted} />
          </View>
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Phone *</Text>
          <TextInput style={s.input} value={form.phone} onChangeText={v => set('phone', v)} placeholder="+971 XX XXX XXXX" placeholderTextColor={COLORS.muted} keyboardType="phone-pad" />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>WhatsApp</Text>
          <TextInput style={s.input} value={form.whatsapp} onChangeText={v => set('whatsapp', v)} placeholder="Same as phone?" placeholderTextColor={COLORS.muted} keyboardType="phone-pad" />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={form.email} onChangeText={v => set('email', v)} placeholder="email@example.com" placeholderTextColor={COLORS.muted} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <PickerRow label="Nationality" value={form.nationality} options={NATIONALITIES} field="nationality" />

        {/* Lead Source */}
        <Text style={s.section}>LEAD SOURCE</Text>
        <PickerRow label="Source" value={form.lead_source} options={SOURCES} field="lead_source" />

        <View style={s.fieldWrap}>
          <Text style={s.label}>Sub Source</Text>
          <TextInput style={s.input} value={form.sub_source} onChangeText={v => set('sub_source', v)} placeholder="e.g. Facebook, Instagram" placeholderTextColor={COLORS.muted} />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Campaign Name</Text>
          <TextInput style={s.input} value={form.campaign_name} onChangeText={v => set('campaign_name', v)} placeholder="e.g. JVC 2BR Campaign" placeholderTextColor={COLORS.muted} />
        </View>

        {/* Property Requirements */}
        <Text style={s.section}>PROPERTY REQUIREMENTS</Text>
        <PickerRow label="Property Type" value={form.property_type} options={PROPERTY_TYPES} field="property_type" />
        <PickerRow label="Bedrooms" value={form.bedrooms} options={BEDROOMS} field="bedrooms" />

        <View style={s.fieldWrap}>
          <Text style={s.label}>Community / Area</Text>
          <TextInput style={s.input} value={form.communities} onChangeText={v => set('communities', v)} placeholder="e.g. JVC, Downtown, Palm Jumeirah" placeholderTextColor={COLORS.muted} />
        </View>

        <View style={s.row}>
          <View style={[s.fieldWrap, { flex: 1 }]}>
            <Text style={s.label}>Min Budget (AED)</Text>
            <TextInput style={s.input} value={form.min_budget} onChangeText={v => set('min_budget', v)} placeholder="500,000" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
          </View>
          <View style={{ width: 10 }} />
          <View style={[s.fieldWrap, { flex: 1 }]}>
            <Text style={s.label}>Max Budget (AED)</Text>
            <TextInput style={s.input} value={form.max_budget} onChangeText={v => set('max_budget', v)} placeholder="1,500,000" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
          </View>
        </View>

        <PickerRow label="Purpose" value={form.purpose} options={PURPOSES} field="purpose" />
        <PickerRow label="Timeline" value={form.timeline} options={TIMELINES} field="timeline" />

        {/* Assignment & Status */}
        <Text style={s.section}>ASSIGNMENT & STATUS</Text>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Assign to Agent</Text>
          <TouchableOpacity style={s.picker} onPress={() => setAgentModal(true)}>
            <Text style={[s.pickerText, !form.assigned_agent_name && { color: COLORS.muted }]}>
              {form.assigned_agent_name || 'Select agent'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <PickerRow label="Status" value={form.lead_status} options={statusOptions} field="lead_status" />
        <PickerRow label="Status Reason" value={form.status_reason} options={reasonOptions} field="status_reason" />
        <PickerRow label="Stage" value={form.lead_stage} options={STAGES} field="lead_stage" />
        <PickerRow label="Priority" value={form.priority} options={PRIORITIES} field="priority" />

        {/* Notes */}
        <Text style={s.section}>NOTES</Text>
        <View style={s.fieldWrap}>
          <Text style={s.label}>Remarks</Text>
          <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={form.remarks} onChangeText={v => set('remarks', v)} placeholder="Any additional notes about this lead..." placeholderTextColor={COLORS.muted} multiline />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Next Action</Text>
          <TextInput style={s.input} value={form.next_action} onChangeText={v => set('next_action', v)} placeholder="e.g. Call back tomorrow, Send listings" placeholderTextColor={COLORS.muted} />
        </View>

        <TouchableOpacity style={[s.saveBtn, loading && { opacity: 0.7 }]} onPress={saveLead} disabled={loading}>
          {loading
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.saveBtnText}>Saving & generating AI summary...</Text></>
            : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={s.saveBtnText}>Save Lead</Text></>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Agent picker modal */}
      <Modal visible={agentModal} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} onPress={() => setAgentModal(false)} />
        <View style={s.sheet}>
          <Text style={s.sheetTitle}>Select Agent</Text>
          <ScrollView>
            <TouchableOpacity style={s.sheetItem} onPress={() => { set('assigned_agent_name', ''); set('assigned_agent_id', ''); setAgentModal(false); }}>
              <Text style={s.sheetItemText}>Unassigned</Text>
            </TouchableOpacity>
            {agents.map(agent => (
              <TouchableOpacity key={agent.id} style={[s.sheetItem, form.assigned_agent_id === agent.id && s.sheetItemActive]} onPress={() => { set('assigned_agent_name', agent.full_name); set('assigned_agent_id', agent.id); setAgentModal(false); }}>
                <Text style={[s.sheetItemText, form.assigned_agent_id === agent.id && s.sheetItemTextActive]}>{agent.full_name}</Text>
                {form.assigned_agent_id === agent.id && <Ionicons name="checkmark" size={16} color={COLORS.red} />}
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
  scroll: { flex: 1, padding: 14 },
  section: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row' },
  fieldWrap: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.muted, marginBottom: 5, letterSpacing: 0.3 },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  picker: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { fontSize: 14, color: COLORS.text },
  saveBtn: { backgroundColor: COLORS.red, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sheetItemActive: { backgroundColor: COLORS.redLight },
  sheetItemText: { fontSize: 14, color: COLORS.text },
  sheetItemTextActive: { color: COLORS.red, fontWeight: '700' },
});
