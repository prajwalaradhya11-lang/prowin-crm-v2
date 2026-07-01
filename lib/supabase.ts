import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ─── REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS ───────────────────
// Find them at: https://supabase.com → Your Project → Settings → API
const SUPABASE_URL = 'https://yedjmpxdwnvkadkbuawf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZGptcHhkd252a2Fka2J1YXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTM1MDIsImV4cCI6MjA5NDEyOTUwMn0.aAflAfWR8edcovFI4vooV3GyOKm_ZgLJaY0QRvVZkU0';
// ────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── APP CONSTANTS ──────────────────────────────────────────────────────────
export const COLORS = {
  red: '#c0392b',
  red2: '#e74c3c',
  redLight: '#fef2f2',
  redBorder: '#fecaca',
  navy: '#1a1a2e',
  text: '#1a1a2e',
  muted: '#6b7280',
  mutedLight: '#9ca3af',
  bg: '#f5f5f7',
  white: '#ffffff',
  border: '#e5e7eb',
  green: '#16a34a',
  greenLight: '#f0fdf4',
  greenBorder: '#bbf7d0',
  amber: '#d97706',
  amberLight: '#fffbeb',
  amberBorder: '#fde68a',
  blue: '#2563eb',
  blueLight: '#eff6ff',
  blueBorder: '#bfdbfe',
};

export const LEAD_STATUSES = ['New', 'Hot', 'Warm', 'Cold', 'Won', 'Lost'];

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Hot:  { bg: COLORS.redLight,   text: COLORS.red,   border: COLORS.redBorder },
  Warm: { bg: COLORS.amberLight, text: COLORS.amber, border: COLORS.amberBorder },
  New:  { bg: COLORS.blueLight,  text: COLORS.blue,  border: COLORS.blueBorder },
  Won:  { bg: COLORS.greenLight, text: COLORS.green, border: COLORS.greenBorder },
  Cold: { bg: '#f9fafb',         text: COLORS.muted, border: COLORS.border },
  Lost: { bg: '#f9fafb',         text: COLORS.muted, border: COLORS.border },
  'Meeting Scheduled': { bg: COLORS.blueLight, text: COLORS.blue, border: COLORS.blueBorder },
  Callback: { bg: COLORS.amberLight, text: COLORS.amber, border: COLORS.amberBorder },
  Pending: { bg: COLORS.amberLight, text: COLORS.amber, border: COLORS.amberBorder },
  'Not Interested': { bg: '#f9fafb', text: COLORS.muted, border: COLORS.border },
  Dropped: { bg: '#f9fafb', text: COLORS.muted, border: COLORS.border },
  Invoiced: { bg: COLORS.greenLight, text: COLORS.green, border: COLORS.greenBorder },
  Booked: { bg: COLORS.greenLight, text: COLORS.green, border: COLORS.greenBorder },
  'Booking Cancel': { bg: COLORS.redLight, text: COLORS.red, border: COLORS.redBorder },
};

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? { bg: COLORS.redLight, text: COLORS.red, border: COLORS.redBorder };
}

export const CLAUDE_API_KEY = 'YOUR_CLAUDE_API_KEY_HERE';
// Get from: https://console.anthropic.com → API Keys
