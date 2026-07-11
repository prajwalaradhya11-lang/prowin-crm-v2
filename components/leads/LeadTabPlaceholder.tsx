import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';

type LeadTabPlaceholderProps = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  subtitle?: string;
};

export function LeadTabPlaceholder({ title, icon, subtitle }: LeadTabPlaceholderProps) {
  return (
    <View style={s.wrap}>
      <Ionicons name={icon} size={40} color={THEME.border} />
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>
        {subtitle ?? 'This section will be built in a later phase.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.heading,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.meta,
    textAlign: 'center',
    lineHeight: 20,
  },
});
