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
import {
  buildDatedExportBasename,
  exportRowsToFileUri,
  shareExportFile,
} from '../../lib/exportDownload';
import { fetchAllRecruitment, type RecruitmentExportRow } from '../../lib/fetchAllRecruitment';
import { RECRUITMENT_EXPORT_COLUMNS } from '../../lib/recruitmentExportColumns';

const RECRUITMENT_SELECT_COLUMNS =
  'id,candidate_name,source,position_applied,phone,email,interview_status,offer_status,joining_status,notes,cv_url,assigned_recruiter_id,assigned_recruiter_name,added_by_id,added_by_name,call_status,follow_up_date,created_at';

const STATUS_FILTER_OPTIONS = [
  'All',
  'New',
  'Contacted',
  'Interview',
  'Shortlisted',
  'Hired',
  'Rejected',
] as const;

type CreatedDatePreset = 'all' | 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

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
  added_by_id: string | null;
  added_by_name: string | null;
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

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
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

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getCreatedAtFilterRange(
  preset: CreatedDatePreset,
  customFrom: string,
  customTo: string,
): { fromMs: number | null; toMs: number | null } {
  const now = new Date();
  const todayStart = startOfLocalDay(now);

  if (preset === 'all') return { fromMs: null, toMs: null };
  if (preset === 'today') {
    return { fromMs: todayStart.getTime(), toMs: endOfLocalDay(now).getTime() };
  }
  if (preset === 'last7') {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 6);
    return { fromMs: from.getTime(), toMs: endOfLocalDay(now).getTime() };
  }
  if (preset === 'last30') {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 29);
    return { fromMs: from.getTime(), toMs: endOfLocalDay(now).getTime() };
  }
  if (preset === 'thisMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { fromMs: from.getTime(), toMs: endOfLocalDay(now).getTime() };
  }

  let fromMs: number | null = null;
  let toMs: number | null = null;
  if (customFrom.trim()) {
    const parsed = new Date(`${customFrom.trim()}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) fromMs = startOfLocalDay(parsed).getTime();
  }
  if (customTo.trim()) {
    const parsed = new Date(`${customTo.trim()}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) toMs = endOfLocalDay(parsed).getTime();
  }
  return { fromMs, toMs };
}

function candidateMatchesSearch(candidate: RecruitmentCandidate, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const lower = query.toLowerCase();
  if ((candidate.candidate_name ?? '').toLowerCase().includes(lower)) return true;
  if ((candidate.email ?? '').toLowerCase().includes(lower)) return true;
  if ((candidate.position_applied ?? '').toLowerCase().includes(lower)) return true;

  const queryDigits = digitsOnly(query);
  if (queryDigits) {
    const phoneDigits = digitsOnly(candidate.phone ?? '');
    if (phoneDigits.includes(queryDigits)) return true;
  }
  return false;
}

function candidateMatchesCreatedAt(
  candidate: RecruitmentCandidate,
  fromMs: number | null,
  toMs: number | null,
): boolean {
  if (fromMs == null && toMs == null) return true;
  if (!candidate.created_at) return false;
  const createdMs = new Date(candidate.created_at).getTime();
  if (Number.isNaN(createdMs)) return false;
  if (fromMs != null && createdMs < fromMs) return false;
  if (toMs != null && createdMs > toMs) return false;
  return true;
}

function candidateMatchesAddedBy(
  candidate: RecruitmentCandidate,
  addedByFilter: string,
): boolean {
  if (addedByFilter === 'all') return true;
  if (addedByFilter === 'unknown') {
    return !candidate.added_by_id && !candidate.added_by_name?.trim();
  }
  if (candidate.added_by_id) return candidate.added_by_id === addedByFilter;
  return (candidate.added_by_name ?? '').trim() === addedByFilter;
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

  const added_by_id = user?.id ?? null;
  const added_by_name = user
    ? (user.name?.trim() || user.email || 'User')
    : null;

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
    added_by_id,
    added_by_name,
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
  const addedBy = candidate.added_by_name?.trim();

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
          {addedBy ? (
            <Text style={s.cardAddedBy} numberOfLines={1}>
              Added by: {addedBy}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [createdPreset, setCreatedPreset] = useState<CreatedDatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [addedByFilter, setAddedByFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  const baseFiltered = useMemo(() => {
    const createdRange = getCreatedAtFilterRange(createdPreset, customFrom, customTo);
    return candidates.filter((candidate) => {
      if (!candidateMatchesSearch(candidate, searchQuery)) return false;
      if (!candidateMatchesCreatedAt(candidate, createdRange.fromMs, createdRange.toMs)) return false;
      if (!candidateMatchesAddedBy(candidate, addedByFilter)) return false;
      return true;
    });
  }, [addedByFilter, candidates, createdPreset, customFrom, customTo, searchQuery]);

  const candidatesByTab = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.map((filter) =>
        baseFiltered.filter((candidate) => candidateMatchesStatusFilter(candidate, filter)),
      ),
    [baseFiltered],
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

  const addedByFilterOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const candidate of candidates) {
      if (candidate.added_by_id) {
        const label = candidate.added_by_name?.trim() || candidate.added_by_id;
        if (!byKey.has(candidate.added_by_id)) byKey.set(candidate.added_by_id, label);
      } else if (candidate.added_by_name?.trim()) {
        const name = candidate.added_by_name.trim();
        if (!byKey.has(name)) byKey.set(name, name);
      }
    }
    return Array.from(byKey.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [candidates]);

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
      .is('deleted_at', null)
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

  const runRecruitmentExport = useCallback(
    async (scope: 'filtered' | 'all') => {
      setExporting(true);
      try {
        let rows: RecruitmentExportRow[];
        if (scope === 'filtered') {
          rows = (candidatesByTab[activeTabIndex] ?? []) as RecruitmentExportRow[];
          if (rows.length === 0) {
            Alert.alert('Export', 'No candidates in the current filtered view to export.');
            return;
          }
        } else {
          const { data, error } = await fetchAllRecruitment(user, role);
          if (error) throw error;
          rows = data;
          if (rows.length === 0) {
            Alert.alert('Export', 'No candidates to export.');
            return;
          }
        }

        const uri = await exportRowsToFileUri({
          rows,
          columns: RECRUITMENT_EXPORT_COLUMNS,
          filename: buildDatedExportBasename('recruitment_candidates'),
        });
        await shareExportFile(uri, { dialogTitle: 'Export candidates CSV' });
      } catch (e) {
        Alert.alert(
          'Export failed',
          e instanceof Error ? e.message : 'Could not export candidates.',
        );
      } finally {
        setExporting(false);
      }
    },
    [activeTabIndex, candidatesByTab, role, user],
  );

  const handleExportPress = useCallback(() => {
    if (exporting) return;
    Alert.alert('Export candidates', 'Choose which candidates to export as CSV.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Current filtered view',
        onPress: () => void runRecruitmentExport('filtered'),
      },
      {
        text: 'All records',
        onPress: () => void runRecruitmentExport('all'),
      },
    ]);
  }, [exporting, runRecruitmentExport]);

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
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.exportBtn}
              onPress={handleExportPress}
              disabled={exporting || showLoading}
              accessibilityLabel="Export candidates"
            >
              {exporting ? (
                <ActivityIndicator size="small" color={COLORS.red} />
              ) : (
                <Ionicons name="download-outline" size={20} color={COLORS.red} />
              )}
            </TouchableOpacity>
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
          </View>
        }
      />
      <PageTitle label="Recruitment" title="Candidates" />

      {!showLoading && (
        <View style={s.filterBar}>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name, phone, email, role…"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterChipsRow}
          >
            <View style={s.filterChip}>
              <Text style={s.filterChipLabel}>Created</Text>
              <View style={s.filterSelectWrap}>
                {([
                  ['all', 'All time'],
                  ['today', 'Today'],
                  ['last7', 'Last 7 days'],
                  ['last30', 'Last 30 days'],
                  ['thisMonth', 'This month'],
                  ['custom', 'Custom'],
                ] as const).map(([value, label]) => {
                  const active = createdPreset === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[s.presetChip, active && s.presetChipOn]}
                      onPress={() => setCreatedPreset(value)}
                    >
                      <Text style={[s.presetChipText, active && s.presetChipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {createdPreset === 'custom' && (
            <View style={s.customDateRow}>
              <View style={s.customDateField}>
                <Text style={s.filterChipLabel}>From</Text>
                <TextInput
                  style={s.dateInput}
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                />
              </View>
              <View style={s.customDateField}>
                <Text style={s.filterChipLabel}>To</Text>
                <TextInput
                  style={s.dateInput}
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          <View style={s.addedByRow}>
            <Text style={s.filterChipLabel}>Added by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterSelectWrap}>
              <TouchableOpacity
                style={[s.presetChip, addedByFilter === 'all' && s.presetChipOn]}
                onPress={() => setAddedByFilter('all')}
              >
                <Text style={[s.presetChipText, addedByFilter === 'all' && s.presetChipTextOn]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.presetChip, addedByFilter === 'unknown' && s.presetChipOn]}
                onPress={() => setAddedByFilter('unknown')}
              >
                <Text style={[s.presetChipText, addedByFilter === 'unknown' && s.presetChipTextOn]}>
                  Unknown
                </Text>
              </TouchableOpacity>
              {addedByFilterOptions.map((option) => {
                const active = addedByFilter === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[s.presetChip, active && s.presetChipOn]}
                    onPress={() => setAddedByFilter(option.value)}
                  >
                    <Text style={[s.presetChipText, active && s.presetChipTextOn]} numberOfLines={1}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.redBorder,
  },
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
  cardAddedBy: { fontSize: 11, color: THEME.meta, marginTop: 4 },
  filterBar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  searchInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 14,
    color: COLORS.text,
  },
  filterChipsRow: { gap: 6, alignItems: 'center', paddingRight: 8 },
  filterChip: { gap: 4 },
  filterChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  filterSelectWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  presetChipOn: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  presetChipText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  presetChipTextOn: { color: '#fff' },
  customDateRow: { flexDirection: 'row', gap: 8 },
  customDateField: { flex: 1, gap: 4 },
  dateInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: COLORS.text,
  },
  addedByRow: { gap: 4 },
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
