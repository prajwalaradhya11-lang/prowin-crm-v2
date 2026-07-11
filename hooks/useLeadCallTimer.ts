import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';

type PendingCall = { bgStart: number | null };

export function useLeadCallTimer(onCallEnded: (durationSeconds: number) => void) {
  const pendingRef = useRef<PendingCall | null>(null);
  const appStateRef = useRef(AppState.currentState);

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
      ) {
        const elapsedMs = Date.now() - pendingRef.current.bgStart;
        const durationSeconds = Math.max(0, Math.round(elapsedMs / 1000));
        pendingRef.current = null;
        onCallEnded(durationSeconds);
      }
    });
    return () => sub.remove();
  }, [onCallEnded]);

  const startLeadCall = useCallback((phone: string | null | undefined) => {
    if (!phone?.trim()) return;
    pendingRef.current = { bgStart: null };
    Linking.openURL(`tel:${phone.trim()}`);
  }, []);

  return { startLeadCall };
}
