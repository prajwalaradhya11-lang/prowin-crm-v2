import React, { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, COLORS } from '../../lib/supabase';
import { useCrmSession } from '../../hooks/useCrmSession';

const TAB_BAR_CONTENT_HEIGHT = 48;

type TabName =
  | 'index'
  | 'leads'
  | 'coldcalling'
  | 'tasks'
  | 'reports'
  | 'hrms'
  | 'recruitment';

const AGENT_TAB_ORDER: TabName[] = [
  'index',
  'leads',
  'coldcalling',
  'tasks',
  'reports',
  'hrms',
  'recruitment',
];

const HR_TAB_ORDER: TabName[] = [
  'index',
  'hrms',
  'recruitment',
  'tasks',
  'reports',
  'leads',
  'coldcalling',
];

function isHrRole(role: string | null): boolean {
  return role === 'hr_manager' || role === 'recruiter';
}

function tabScreenOptions(name: TabName) {
  switch (name) {
    case 'index':
      return {
        title: 'Home',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="home-outline" size={size} color={color} />
        ),
      };
    case 'leads':
      return {
        title: 'Leads',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="people-outline" size={size} color={color} />
        ),
      };
    case 'coldcalling':
      return {
        title: 'Calls',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="call-outline" size={size} color={color} />
        ),
      };
    case 'tasks':
      return {
        title: 'Tasks',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="checkbox-outline" size={size} color={color} />
        ),
      };
    case 'reports':
      return {
        title: 'Reports',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="bar-chart-outline" size={size} color={color} />
        ),
      };
    case 'hrms':
      return {
        title: 'HRMS',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="people-outline" size={size} color={color} />
        ),
      };
    case 'recruitment':
      return {
        title: 'Recruitment',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons name="person-add-outline" size={size} color={color} />
        ),
      };
  }
}

function tabIsVisible(name: TabName, hrTabs: boolean): boolean {
  switch (name) {
    case 'index':
    case 'tasks':
    case 'reports':
      return true;
    case 'leads':
    case 'coldcalling':
      return !hrTabs;
    case 'hrms':
    case 'recruitment':
      return hrTabs;
  }
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const { role, loading: roleLoading } = useCrmSession();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready || roleLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  if (!hasSession) {
    return <Redirect href="/(auth)/login" />;
  }

  const hrTabs = isHrRole(role);
  const tabOrder = hrTabs ? HR_TAB_ORDER : AGENT_TAB_ORDER;
  const tabBarPaddingBottom = insets.bottom + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.red,
        tabBarInactiveTintColor: '#000000',
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: tabBarPaddingBottom,
          height: TAB_BAR_CONTENT_HEIGHT + 6 + tabBarPaddingBottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      {tabOrder.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            ...tabScreenOptions(name),
            href: tabIsVisible(name, hrTabs) ? undefined : null,
          }}
        />
      ))}
    </Tabs>
  );
}
