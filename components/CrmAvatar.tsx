import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const AVATAR_COLORS = ['#C0392B', '#2563EB', '#E28A2B', '#1FA971', '#7C3AED', '#0891B2'];

type CrmAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
  color?: string;
};

export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function CrmAvatar({ name, photoUrl, size = 42, color }: CrmAvatarProps) {
  const initials = useMemo(() => getInitialsFromName(name), [name]);
  const bg = color ?? colorFromName(name);
  const fontSize = Math.max(11, Math.round(size * 0.34));

  if (photoUrl?.trim()) {
    return (
      <Image
        source={{ uri: photoUrl.trim() }}
        style={[s.image, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      style={[
        s.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${bg}22`,
          borderColor: `${bg}44`,
        },
      ]}
    >
      <Text style={[s.initials, { color: bg, fontSize }]}>{initials}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  image: { backgroundColor: '#ececec' },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: { fontWeight: '800' },
});
