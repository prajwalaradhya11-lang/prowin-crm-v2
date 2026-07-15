import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, AppState, AppStateStatus, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { supabase, COLORS } from '../../lib/supabase';
import { StatusBadge, ContactAvatar, ActionButtons } from '../../components/ui';
import { SafeScreenHeader } from '../../components/SafeScreenHeader';
import { ContactNavRow } from '../../components/ContactNavRow';
import { LogCallModal } from '../../components/LogCallModal';
import { getContactName } from '../../lib/contactName';
import { ColdCallContactDetail, ColdCallContactListItem, digitsOnly } from '../../lib/coldCallContact';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  getAdjacentContactId, getColdCallNavIds, getContactNavIndex,
} from '../../lib/coldCallNav';
import { useSwipeEntityNav } from '../../hooks/useSwipeEntityNav';
import {
  requestCallLogPermission,
  resolveAfterOutgoingCall,
  type CallDurationSource,
} from '../../lib/androidCallLog';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldVal}>{value?.trim() ? value : '—'}</Text>
    </View>
  );
}

export default function ColdCallContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [contact, setContact] = useState<ColdCallContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState(false);
  const [durationLocked, setDurationLocked] = useState(false);
  const [durationSource, setDurationSource] = useState<CallDurationSource | 'manual' | null>(null);
  const [lockedDurationSeconds, setLockedDurationSeconds] = useState(0);
  const [initialDuration, setInitialDuration] = useState('0');

  const pendingCallRef = useRef<{
    contactId: string;
    phone: string;
    startedAtMs: number;
    bgStart: number | null;
  } | null>(null);
  const resolvingCallRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const loadContact = useCallback(async (contactId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cold_call_contacts')
      .select('*')
      .eq('id', contactId)
      .single();
    if (error) console.log('Contact fetch error:', error.message);
    setContact(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (id) loadContact(id);
  }, [id, loadContact]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' && pendingCallRef.current) {
        pendingCallRef.current.bgStart = Date.now();
      }

      if (
        prev.match(/inactive|background/)
        && nextState === 'active'
        && pendingCallRef.current?.bgStart
        && !resolvingCallRef.current
      ) {
        const pending = pendingCallRef.current;
        pendingCallRef.current = null;
        resolvingCallRef.current = true;

        const elapsedMs = Date.now() - (pending.bgStart ?? Date.now());
        const timerFallbackSeconds = Math.max(0, Math.round(elapsedMs / 1000));
        const mins = Math.max(0, Math.round(elapsedMs / 60000));

        void (async () => {
          try {
            const resolved = await resolveAfterOutgoingCall({
              phone: pending.phone,
              startedAtMs: pending.startedAtMs,
              timerFallbackSeconds,
            });

            if (resolved.source === 'call_log') {
              setLockedDurationSeconds(resolved.durationSeconds);
              setDurationSource('call_log');
              setInitialDuration('0');
            } else {
              setLockedDurationSeconds(0);
              setDurationSource('timer');
              setInitialDuration(String(mins));
            }
            setDurationLocked(true);
            setLogModal(true);
          } catch (error) {
            console.warn('[coldcall detail] resolve duration failed', error);
            setLockedDurationSeconds(0);
            setDurationSource('timer');
            setInitialDuration(String(mins));
            setDurationLocked(true);
            setLogModal(true);
          } finally {
            resolvingCallRef.current = false;
          }
        })();
      }
    });
    return () => sub.remove();
  }, []);

  const navigateToContact = useCallback((nextId: string | null) => {
    if (!nextId) return;
    router.replace(`/coldcall/${nextId}`);
  }, []);

  const handlePrev = useCallback(() => {
    if (!id) return;
    setDurationLocked(false);
    setDurationSource(null);
    setLockedDurationSeconds(0);
    setInitialDuration('0');
    navigateToContact(getAdjacentContactId(id, -1));
  }, [id, navigateToContact]);

  const handleNext = useCallback(() => {
    if (!id) return;
    setDurationLocked(false);
    setDurationSource(null);
    setLockedDurationSeconds(0);
    setInitialDuration('0');
    navigateToContact(getAdjacentContactId(id, 1));
  }, [id, navigateToContact]);

  const navIds = getColdCallNavIds();
  const swipeGesture = useSwipeEntityNav(handlePrev, handleNext, navIds.length > 1);

  function handleInAppCall(c: ColdCallContactListItem) {
    if (!c.phone) return;
    pendingCallRef.current = {
      contactId: c.id,
      phone: c.phone.trim(),
      startedAtMs: Date.now(),
      bgStart: null,
    };
    if (Platform.OS === 'android') {
      void requestCallLogPermission();
    }
    Linking.openURL(`tel:${c.phone}`);
  }

  function handleWhatsApp(c: ColdCallContactListItem) {
    const d = digitsOnly(c.whatsapp || c.phone);
    if (!d) return;
    Linking.openURL(`https://wa.me/${d}`);
  }

  function handleEmail(c: ColdCallContactListItem) {
    if (!c.email?.trim()) return;
    Linking.openURL(`mailto:${c.email.trim()}`);
  }

  function openLogModalManual() {
    setInitialDuration('0');
    setDurationLocked(false);
    setDurationSource('manual');
    setLockedDurationSeconds(0);
    setLogModal(true);
  }

  function closeLogModal() {
    setLogModal(false);
    setDurationLocked(false);
    setDurationSource(null);
    setLockedDurationSeconds(0);
    setInitialDuration('0');
  }

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  if (!contact || !id) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.emptyText}>Contact not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const navIndex = getContactNavIndex(id);
  const hasPrev = navIndex > 0;
  const hasNext = navIndex >= 0 && navIndex < navIds.length - 1;
  const displayName = getContactName(contact);
  const hasEmail = Boolean(contact.email?.trim());

  return (
    <View style={s.container}>
      <SafeScreenHeader
        title=""
        onBack={() => router.back()}
        centerContent={
          <ContactNavRow
            name={displayName}
            onPrev={handlePrev}
            onNext={handleNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        }
      />

      <GestureDetector gesture={swipeGesture}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.card}>
          <View style={s.topRow}>
            <ContactAvatar contact={contact} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{displayName}</Text>
              <Text style={s.phone}>{contact.phone ?? '—'}</Text>
              {contact.email ? <Text style={s.sub}>{contact.email}</Text> : null}
            </View>
            <StatusBadge status={contact.call_status ?? 'Not Called'} />
          </View>

          <ActionButtons
            onCall={() => handleInAppCall(contact)}
            onWhatsApp={() => handleWhatsApp(contact)}
            onEmail={() => handleEmail(contact)}
            onView={openLogModalManual}
            emailDisabled={!hasEmail}
          />

          <View style={s.grid}>
            <Field label="WHATSAPP" value={contact.whatsapp} />
            <Field label="NATIONALITY" value={contact.nationality} />
            <Field label="PROPERTY OWNED" value={contact.property_owned} />
            <Field label="LOCATION" value={contact.location} />
            <Field label="COMMUNITY" value={contact.community} />
            <Field label="PROPERTY TYPE" value={contact.property_type} />
            <Field label="BEDROOMS" value={contact.bedrooms} />
            <Field label="SOURCE" value={contact.source} />
            <Field label="INTEREST" value={contact.interest_level} />
            <Field label="FOLLOW-UP" value={contact.follow_up_date ? format(new Date(contact.follow_up_date), 'd MMM yyyy') : null} />
            <Field label="ATTEMPTS" value={String(contact.call_attempts ?? 0)} />
            <Field label="LAST RESULT" value={contact.last_call_result} />
            <Field label="LAST CALLED" value={contact.last_called_at ? format(new Date(contact.last_called_at), 'd MMM yyyy HH:mm') : null} />
          </View>

          {contact.notes ? (
            <View style={s.notesBox}>
              <Text style={s.fieldLabel}>NOTES</Text>
              <Text style={s.notesText}>{contact.notes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      </GestureDetector>

      <LogCallModal
        visible={logModal}
        contact={contact}
        selectedAgentId={contact.assigned_agent_id}
        selectedAgentName={contact.assigned_agent_name ?? ''}
        durationLocked={durationLocked}
        durationSource={durationSource}
        lockedDurationSeconds={lockedDurationSeconds}
        initialDurationMinutes={initialDuration}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        onClose={closeLogModal}
        onSaved={() => loadContact(id)}
        onCall={handleInAppCall}
        onWhatsApp={handleWhatsApp}
        onEmail={handleEmail}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 3,
    borderTopColor: COLORS.red,
    padding: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  phone: { fontSize: 13, fontWeight: '600', color: COLORS.red, marginTop: 4 },
  sub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  field: { flex: 1, minWidth: '45%', backgroundColor: COLORS.bg, borderRadius: 8, padding: 8 },
  fieldLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.4, marginBottom: 2 },
  fieldVal: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  notesBox: { marginTop: 12, backgroundColor: COLORS.bg, borderRadius: 10, padding: 10 },
  notesText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.muted },
  backLink: { marginTop: 12, fontSize: 14, fontWeight: '700', color: COLORS.red },
});
