import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/supabase';

export default function RecruitmentScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Text style={s.heading}>Recruitment</Text>
      <Text style={s.subtitle}>Coming next</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },
});
