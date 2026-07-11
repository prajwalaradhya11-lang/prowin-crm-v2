import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../lib/prowinTheme';

export type LeadDetailTabId = 'info' | 'enquiry' | 'history' | 'notes' | 'docs';

export const LEAD_DETAIL_TABS: {
  id: LeadDetailTabId;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'info', label: 'Info', icon: 'information-circle-outline' },
  { id: 'enquiry', label: 'Enquiry', icon: 'search-outline' },
  { id: 'history', label: 'History', icon: 'time-outline' },
  { id: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { id: 'docs', label: 'Docs', icon: 'folder-outline' },
];

type LeadDetailTabBarProps = {
  activeIndex: number;
  onTabPress: (index: number) => void;
};

export function LeadDetailTabBar({ activeIndex, onTabPress }: LeadDetailTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + 8 }]}>
      {LEAD_DETAIL_TABS.map((tab, index) => {
        const active = index === activeIndex;
        return (
          <TouchableOpacity
            key={tab.id}
            style={s.tab}
            onPress={() => onTabPress(index)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={active ? THEME.red : THEME.meta}
            />
            <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.meta,
  },
  labelActive: {
    color: THEME.red,
    fontWeight: '800',
  },
});
