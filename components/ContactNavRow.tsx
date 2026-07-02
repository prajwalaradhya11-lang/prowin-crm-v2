import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/supabase';

type Props = {
  name: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function ContactNavRow({ name, onPrev, onNext, hasPrev, hasNext }: Props) {
  return (
    <View style={s.row}>
      <TouchableOpacity
        onPress={onPrev}
        disabled={!hasPrev}
        style={[s.navBtn, !hasPrev && s.navBtnDisabled]}
      >
        <Ionicons name="chevron-back" size={20} color={hasPrev ? COLORS.text : COLORS.mutedLight} />
      </TouchableOpacity>
      <Text style={s.name} numberOfLines={1}>{name}</Text>
      <TouchableOpacity
        onPress={onNext}
        disabled={!hasNext}
        style={[s.navBtn, !hasNext && s.navBtnDisabled]}
      >
        <Ionicons name="chevron-forward" size={20} color={hasNext ? COLORS.text : COLORS.mutedLight} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.bg,
  },
  navBtnDisabled: { opacity: 0.4 },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
});
