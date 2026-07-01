import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, COLORS } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.topSection}>
        <View style={s.logoBox}>
          <Text style={s.logoP}>P</Text>
        </View>
        <Text style={s.brandName}>PROWIN</Text>
        <Text style={s.brandSub}>PROPERTIES</Text>
        <Text style={s.welcomeText}>Agent CRM</Text>
        <Text style={s.subText}>Sign in to your account</Text>
      </View>

      <View style={s.formCard}>
        <Text style={s.fieldLabel}>EMAIL ADDRESS</Text>
        <TextInput
          style={s.input}
          placeholder="you@prowinproperties.com"
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[s.fieldLabel, { marginTop: 14 }]}>PASSWORD</Text>
        <TextInput
          style={s.input}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[s.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.loginBtnText}>Sign In</Text>}
        </TouchableOpacity>

        <Text style={s.helpText}>
          Having trouble? Contact your manager.
        </Text>
      </View>

      <Text style={s.footer}>© 2026 Prowin Properties LLC · Dubai</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topSection: { alignItems: 'center', marginBottom: 32 },
  logoBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoP: { fontSize: 32, fontWeight: '900', color: '#fff' },
  brandName: { fontSize: 22, fontWeight: '800', color: COLORS.red, letterSpacing: 2 },
  brandSub: { fontSize: 10, color: COLORS.muted, letterSpacing: 3, fontWeight: '500' },
  welcomeText: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 16 },
  subText: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  formCard: { width: '100%', backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 13, fontSize: 14, color: COLORS.text },
  loginBtn: { backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  helpText: { fontSize: 12, color: COLORS.muted, textAlign: 'center', marginTop: 14 },
  footer: { fontSize: 11, color: COLORS.muted, marginTop: 28 },
});
