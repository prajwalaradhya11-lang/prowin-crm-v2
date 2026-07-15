import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';

import {
  requestCallLogPermission,
  resolveAfterOutgoingCall,
  type CallDurationSource,
} from '../lib/androidCallLog';

export type LeadCallEndedResult = {
  durationSeconds: number;
  source: CallDurationSource;
};

type PendingCall = {
  phone: string;
  startedAtMs: number;
  bgStart: number | null;
};

export function useLeadCallTimer(onCallEnded: (result: LeadCallEndedResult) => void) {
  const pendingRef = useRef<PendingCall | null>(null);
  const resolvingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' && pendingRef.current) {
        pendingRef.current.bgStart = Date.now();
      }

      if (
        prev.match(/inactive|background/)
        && nextState === 'active'
        && pendingRef.current?.bgStart
        && !resolvingRef.current
      ) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        resolvingRef.current = true;

        const elapsedMs = Date.now() - (pending.bgStart ?? Date.now());
        const timerFallbackSeconds = Math.max(0, Math.round(elapsedMs / 1000));

        void (async () => {
          try {
            const resolved = await resolveAfterOutgoingCall({
              phone: pending.phone,
              startedAtMs: pending.startedAtMs,
              timerFallbackSeconds,
            });
            onCallEndedRef.current(resolved);
          } catch (error) {
            console.warn('[useLeadCallTimer] resolve failed', error);
            onCallEndedRef.current({
              durationSeconds: timerFallbackSeconds,
              source: 'timer',
            });
          } finally {
            resolvingRef.current = false;
          }
        })();
      }
    });
    return () => sub.remove();
  }, []);

  const startLeadCall = useCallback((phone: string | null | undefined) => {
    if (!phone?.trim()) return;

    const trimmed = phone.trim();
    pendingRef.current = {
      phone: trimmed,
      startedAtMs: Date.now(),
      bgStart: null,
    };

    if (Platform.OS === 'android') {
      void requestCallLogPermission();
    }

    Linking.openURL(`tel:${trimmed}`);
  }, []);

  return { startLeadCall };
}
