import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase, COLORS } from '../../lib/supabase';
import { ProwinHeader, PageTitle } from '../../components/ui';
import { LeadStatusTabsPager } from '../../components/leads/LeadStatusTabsPager';
import { useCrmSession, getUserDisplayName, type CrmUser } from '../../hooks/useCrmSession';
import { THEME } from '../../lib/prowinTheme';

const RECRUITMENT_SELECT_COLUMNS =
  'id,candidate_name,source,position_applied,phone,email,interview_status,offer_status,joining_status,notes,cv_url,assigned_recruiter_id,assigned_recruiter_name,call_status,follow_up_date,created_at';

const STATUS_FILTER_OPTIONS = [
  'All',
  'New',
  'Contacted',
  'Interview',
  'Shortlisted',
  'Hired',
  'Rejected',
] as const;

type RecruitmentCandidate = {
  id: string;
  candidate_name: string;
  source: string | null;
  position_applied: string | null;
  phone: string | null;
  email: string | null;
  interview_status: string | null;
  offer_status: string | null;
  joining_status: string | null;
  notes: string | null;
  cv_url: string | null;
  assigned_recruiter_id: string | null;
  assigned_recruiter_name: string | null;
  call_status: string | null;
  follow_up_date: string | null;
  created_at: string;
};

type AddCandidateForm = {
  candidateName: string;
  phone: string;
  email: string;
  source: string;
  positionApplied: string;
  notes: string;
};

const EMPTY_FORM: AddCandidateForm = {
  candidateName: '',
  phone: '',
  email: '',
  source: '',
  positionApplied: '',
  notes: '',
};

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCallStatus(status: string | null | undefined): string {
  return status?.trim() || 'New';
}

function candidateMatchesStatusFilter(
  candidate: RecruitmentCandidate,
  filter: (typeof STATUS_FILTER_OPTIONS)[number],
): boolean {
  if (filter === 'All') return true;
  return normalizeCallStatus(candidate.call_status).toLowerCase() === filter.toLowerCase();
}

function isRecruiterRole(role: string | null): boolean {
  return role === 'recruiter';
}

function canViewAllCandidates(role: string | null): boolean {
  return role === 'hr_manager' || role === 'admin' || role === 'super_admin';
}

function buildRecruitmentInsertPayload(
  form: AddCandidateForm,
  role: string | null,
  user: CrmUser | null,
) {
  let assigned_recruiter_id: string | null = null;
  let assigned_recruiter_name: string | null = null;

  if (isRecruiterRole(role) && user?.id) {
    assigned_recruiter_id = user.id;
    assigned_recruiter_name = getUserDisplayName(user);
  }

  return {
    candidate_name: form.candidateName.trim() || 'candidate',
    source: trimOrNull(form.source),
    position_applied: trimOrNull(form.positionApplied),
    phone: trimOrNull(form.phone),
    email: trimOrNull(form.email),
    notes: trimOrNull(form.notes),
    call_status: 'New',
    interview_date: null,
    interview_status: null,
    offer_status: null,
    joining_status: null,
    cv_url: null,
    follow_up_date: null,
    assigned_recruiter_id,
    assigned_recruiter_name,
  };
}

function getCallStatusPillStyle(status: string | null) {
  const label = status?.trim() || 'New';
  const normalized = label.toLowerCase();
  if (normalized === 'new') {
    return { label, bg: THEME.blueFill, border: '#c3daf5', text: THEME.blue };
  }
  if (normalized.includes('follow') || normalized.includes('callback')) {
    return { label, bg: THEME.amberFill, border: '#f5d9a8', text: THEME.amber };
  }
  if (normalized.includes('closed') || normalized.includes('joined') || normalized.includes('hired')) {
    return { label, bg: THEME.greenFill, border: THEME.greenBorder, text: THEME.green };
  }
  return { label, bg: '#f3f3f3', border: THEME.border, text: THEME.meta };
}

function CandidateCard({
  candidate,
  onPress,
}: {
  candidate: RecruitmentCandidate;
  onPress: () => void;
}) {
  const subtitleParts = [candidate.position_applied, candidate.source].filter(Boolean);
  const subtitle = subtitleParts.join(' · ');
  const callStatus = getCallStatusPillStyle(candidate.call_status);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
    >
      <View style={s.cardTop}>
        <View style={s.cardMain}>
          <Text style={s.cardName} numberOfLines={1}>
            {candidate.candidate_name}
          </Text>
          {subtitle ? (
            <Text style={s.cardSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {candidate.phone ? (
            <Text style={s.cardPhone} numberOfLines={1}>
              {candidate.phone}
            </Text>
          ) : null}
        </View>
        <View style={[s.statusPill, { backgroundColor: callStatus.bg, borderColor: callStatus.border }]}>
          <Text style={[s.statusPillText, { color: callStatus.text }]} numberOfLines={1}>
            {callStatus.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function RecruitmentScreen() {
  const { user, role, loading: sessionLoading } = useCrmSession();
  const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState<AddCandidateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const candidatesByTab = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.map((filter) =>
        candidates.filter((candidate) => candidateMatchesStatusFilter(candidate, filter)),
      ),
    [candidates],
  );

  const tabs = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.map((label, index) => ({
        key: label,
        label,
        count: candidatesByTab[index]?.length ?? 0,
      })),
    [candidatesByTab],
  );

  const handleTabIndexChange = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);

  const fetchCandidates = useCallback(async () => {
    if (!canViewAllCandidates(role) && !isRecruiterRole(role)) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    if (isRecruiterRole(role) && !user?.id) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('recruitment')
      .select(RECRUITMENT_SELECT_COLUMNS)
      .order('created_at', { ascending: false });

    if (isRecruiterRole(role) && user?.id) {
      query = query.eq('assigned_recruiter_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.log('[recruitment] fetch error', error.message);
      setCandidates([]);
    } else {
      setCandidates((data ?? []) as RecruitmentCandidate[]);
    }

    setLoading(false);
  }, [role, user?.id]);

  useEffect(() => {
    if (!sessionLoading) {
      setLoading(true);
      void fetchCandidates();
    }
  }, [sessionLoading, fetchCandidates]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCandidates();
    setRefreshing(false);
  }, [fetchCandidates]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setSaveError(null);
  }, []);

  const closeModal = useCallback(() => {
    setAddModal(false);
    resetForm();
  }, [resetForm]);

  const saveCandidate = useCallback(async () => {
    if (!form.candidateName.trim()) {
      setSaveError('Candidate name is required.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = buildRecruitmentInsertPayload(form, role, user);

    const { error } = await supabase.from('recruitment').insert(payload);

    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    closeModal();
    setLoading(true);
    await fetchCandidates();
    Alert.alert('Success', 'Candidate added.');
  }, [form, role, user, closeModal, fetchCandidates]);

  const renderCandidatePage = useCallback(
    (tabIndex: number) => {
      const pageCandidates = candidatesByTab[tabIndex] ?? [];
      const tabLabel = STATUS_FILTER_OPTIONS[tabIndex] ?? 'All';
      const emptyMessage =
        tabLabel === 'All' ? 'No candidates yet' : `No candidates in ${tabLabel}`;

      return (
        <FlatList
          data={pageCandidates}
          keyExtractor={(item) => item.id}
          style={s.list}
          contentContainerStyle={
            pageCandidates.length === 0 ? s.listEmptyContent : s.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            tabIndex === activeTabIndex ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.red} />
            ) : undefined
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="person-add-outline" size={48} color={COLORS.muted} />
              <Text style={s.emptyText}>{emptyMessage}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <CandidateCard
              candidate={item}
              onPress={() => router.push(`/recruitment/${item.id}`)}
            />
          )}
        />
      );
    },
    [activeTabIndex, candidatesByTab, refreshing, onRefresh],
  );

  const modalMaxHeight = Dimensions.get('window').height * 0.9;
  const showLoading = sessionLoading || loading;

  return (
    <View style={s.container}>
      <ProwinHeader
        rightContent={
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => {
              resetForm();
              setAddModal(true);
            }}
            accessibilityLabel="Add candidate"
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        }
      />
      <PageTitle label="Recruitment" title="Candidates" />

      {showLoading ? (
        <ActivityIndicator color={COLORS.red} style={s.loader} />
      ) : (
        <LeadStatusTabsPager
          tabs={tabs}
          activeIndex={activeTabIndex}
          onIndexChange={handleTabIndexChange}
          renderPage={(_, index) => renderCandidatePage(index)}
        />
      )}

      <Modal visible={addModal} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalSheet, { maxHeight: modalMaxHeight }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Candidate</Text>
              <TouchableOpacity onPress={closeModal} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.modalBody}
              contentContainerStyle={s.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.fieldLabel}>CANDIDATE NAME *</Text>
              <TextInput
                style={s.input}
                placeholder="Full name"
                placeholderTextColor={COLORS.muted}
                value={form.candidateName}
                onChangeText={(candidateName) => setForm((prev) => ({ ...prev, candidateName }))}
              />

              <Text style={s.fieldLabel}>PHONE</Text>
              <TextInput
                style={s.input}
                placeholder="Phone number"
                placeholderTextColor={COLORS.muted}
                value={form.phone}
                onChangeText={(phone) => setForm((prev) => ({ ...prev, phone }))}
                keyboardType="phone-pad"
              />

              <Text style={s.fieldLabel}>EMAIL</Text>
              <TextInput
                style={s.input}
                placeholder="Email address"
                placeholderTextColor={COLORS.muted}
                value={form.email}
                onChangeText={(email) => setForm((prev) => ({ ...prev, email }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.fieldLabel}>SOURCE</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. LinkedIn, referral"
                placeholderTextColor={COLORS.muted}
                value={form.source}
                onChangeText={(source) => setForm((prev) => ({ ...prev, source }))}
              />

              <Text style={s.fieldLabel}>POSITION APPLIED</Text>
              <TextInput
                style={s.input}
                placeholder="Role or position"
                placeholderTextColor={COLORS.muted}
                value={form.positionApplied}
                onChangeText={(positionApplied) => setForm((prev) => ({ ...prev, positionApplied }))}
              />

              <Text style={s.fieldLabel}>NOTES</Text>
              <TextInput
                style={[s.input, s.notesInput]}
                placeholder="Additional notes"
                placeholderTextColor={COLORS.muted}
                value={form.notes}
                onChangeText={(notes) => setForm((prev) => ({ ...prev, notes }))}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            {saveError ? <Text style={s.errorText}>{saveError}</Text> : null}

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeModal} disabled={saving}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={() => void saveCandidate()}
                disabled={saving}
              >
                {saving ? (
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
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  cardPhone: { fontSize: 12, fontWeight: '600', color: COLORS.red, marginTop: 4 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '42%',
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },
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
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalBody: { flexGrow: 0 },
  modalBodyContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  notesInput: { minHeight: 96, paddingTop: 11 },
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
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.red,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
