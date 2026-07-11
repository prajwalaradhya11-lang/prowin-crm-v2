import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../lib/supabase';

type Props = {
  title: string;
  onClose?: () => void;
  onBack?: () => void;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  style?: ViewStyle;
};

export function SafeScreenHeader({
  title,
  onClose,
  onBack,
  leftContent,
  rightContent,
  centerContent,
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 12 }, style]}>
      <View style={s.row}>
        {leftContent ?? (
          onBack ? (
            <TouchableOpacity onPress={onBack} style={s.sideBtn}>
              <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.sideBtn} />
          )
        )}
        <View style={s.center}>
          {centerContent ?? (
            <Text style={s.title} numberOfLines={1}>{title}</Text>
          )}
        </View>
        {rightContent ?? (
          onClose ? (
            <TouchableOpacity onPress={onClose} style={s.sideBtn}>
              <Text style={s.closeIcon}>✕</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.sideBtn} />
          )
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  sideBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  backIcon: { fontSize: 28, fontWeight: '600', color: COLORS.text, marginTop: -2 },
  closeIcon: { fontSize: 20, fontWeight: '600', color: COLORS.text },
});
