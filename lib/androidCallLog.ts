import { PermissionsAndroid, Platform } from 'react-native';

export type AndroidOutgoingCallMatch = {
  durationSeconds: number;
  timestamp: number;
  type: string;
};

function isAndroid(): boolean {
  return Platform.OS === 'android';
}

/** Digits only (strips +, spaces, dashes, parens, etc.). */
export function normalizePhoneDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

function phoneSuffixMatch(a: string, b: string, suffixLength = 9): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  const len = Math.min(suffixLength, left.length, right.length);
  if (len < 7) {
    return left === right || left.endsWith(right) || right.endsWith(left);
  }
  return left.slice(-len) === right.slice(-len);
}

/**
 * Request READ_CALL_LOG only. Returns true when granted.
 * Non-Android always returns false.
 */
export async function requestCallLogPermission(): Promise<boolean> {
  if (!isAndroid()) return false;

  try {
    const existing = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
    if (existing) return true;

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
      title: 'Call history permission',
      message: 'Prowin CRM needs access to call history to record the real call duration after dialing a candidate.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[androidCallLog] permission request failed', error);
    return false;
  }
}

type CallLogEntry = {
  phoneNumber?: string;
  formattedNumber?: string;
  duration?: number | string;
  timestamp?: string | number;
  type?: string;
};

function parseTimestampMs(value: string | number | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseDurationSeconds(value: number | string | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function isOutgoingType(type: string | undefined): boolean {
  const t = (type ?? '').toUpperCase();
  return t === 'OUTGOING' || t === 'WIFI_OUTGOING';
}

/**
 * Find the most recent OUTGOING call to `phone` at/after startedAtMs.
 * Android only; returns null on iOS or on any failure / no match.
 */
export async function findRecentOutgoingCall(options: {
  phone: string | null | undefined;
  startedAtMs: number;
}): Promise<AndroidOutgoingCallMatch | null> {
  if (!isAndroid()) return null;

  const dialed = normalizePhoneDigits(options.phone);
  if (!dialed || !Number.isFinite(options.startedAtMs)) return null;

  try {
    // Lazy-require so iOS / Metro never loads the native module at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const CallLogs = require('react-native-call-log').default ?? require('react-native-call-log');

    const minTimestamp = Math.max(0, options.startedAtMs - 5000);
    const raw: CallLogEntry[] = await CallLogs.load(-1, {
      minTimestamp,
      types: ['OUTGOING', 'WIFI_OUTGOING'],
    });

    const candidates = (Array.isArray(raw) ? raw : [])
      .map((entry) => {
        const timestamp = parseTimestampMs(entry.timestamp);
        if (timestamp == null) return null;
        if (timestamp < options.startedAtMs - 5000) return null;
        if (!isOutgoingType(entry.type)) return null;

        const entryNumber = entry.phoneNumber || entry.formattedNumber || '';
        if (!phoneSuffixMatch(entryNumber, dialed)) return null;

        return {
          durationSeconds: parseDurationSeconds(entry.duration),
          timestamp,
          type: String(entry.type ?? 'OUTGOING'),
        } satisfies AndroidOutgoingCallMatch;
      })
      .filter((entry): entry is AndroidOutgoingCallMatch => entry != null)
      .sort((a, b) => b.timestamp - a.timestamp);

    return candidates[0] ?? null;
  } catch (error) {
    console.warn('[androidCallLog] findRecentOutgoingCall failed', error);
    return null;
  }
}

export type CallDurationSource = 'call_log' | 'timer';

export type ResolvedCallDuration = {
  durationSeconds: number;
  source: CallDurationSource;
};

/**
 * Shared post-dial resolution used by lead + cold-call flows.
 * Android: brief delay → findRecentOutgoingCall → call_log match or timer fallback.
 * iOS: always timer fallback.
 * Permission should already have been requested at Call tap time.
 */
export async function resolveAfterOutgoingCall(options: {
  phone: string | null | undefined;
  startedAtMs: number;
  timerFallbackSeconds: number;
}): Promise<ResolvedCallDuration> {
  const timerFallbackSeconds = Math.max(0, Math.round(options.timerFallbackSeconds || 0));

  if (!isAndroid()) {
    return { durationSeconds: timerFallbackSeconds, source: 'timer' };
  }

  // Allow Android time to write the CallLog row after hangup (same window as recruitment).
  const delayMs = 800;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const match = await findRecentOutgoingCall({
    phone: options.phone,
    startedAtMs: options.startedAtMs,
  });

  if (match) {
    return {
      durationSeconds: Math.max(0, match.durationSeconds),
      source: 'call_log',
    };
  }

  return { durationSeconds: timerFallbackSeconds, source: 'timer' };
}
