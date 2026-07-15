import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreenHeader } from '../components/SafeScreenHeader';
import { useCrmSession } from '../hooks/useCrmSession';
import { postAiAssistant, type AiChatMessage } from '../lib/crmApi';
import { COLORS } from '../lib/supabase';

type ChatTurn = AiChatMessage & { id: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AiAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { role, loading: sessionLoading } = useCrmSession();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatTurn>>(null);

  useEffect(() => {
    if (turns.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [turns, sending]);

  if (sessionLoading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator color={COLORS.red} size="large" />
      </View>
    );
  }

  if (role !== 'super_admin') {
    return <Redirect href="/(tabs)" />;
  }

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userTurn: ChatTurn = { id: newId(), role: 'user', content: text };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setInput('');
    setSending(true);

    const messages: AiChatMessage[] = nextTurns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    const result = await postAiAssistant(messages);
    const replyText = result.ok
      ? result.reply
      : result.error || 'Something went wrong. Please try again.';

    setTurns((prev) => [
      ...prev,
      { id: newId(), role: 'assistant', content: replyText },
    ]);
    setSending(false);
  }

  return (
    <View style={s.container}>
      <SafeScreenHeader title="AI Assistant" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(item) => item.id}
          style={s.list}
          contentContainerStyle={[
            s.listContent,
            turns.length === 0 && s.listEmptyContent,
          ]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="sparkles-outline" size={36} color={COLORS.muted} />
              <Text style={s.emptyTitle}>Ask about your CRM</Text>
              <Text style={s.emptySub}>
                Late agents, meetings, recruitment, leads, calls, and red zone — same tools as the web
                assistant.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                s.bubble,
                item.role === 'user' ? s.bubbleUser : s.bubbleAssistant,
              ]}
            >
              <Text
                style={[
                  s.bubbleText,
                  item.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant,
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={
            sending ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.red} />
                <Text style={s.loadingText}>Thinking…</Text>
              </View>
            ) : null
          }
        />

        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask something…"
            placeholderTextColor={COLORS.mutedLight}
            multiline
            editable={!sending}
            onSubmitEditing={() => {
              void onSend();
            }}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={() => {
              void onSend();
            }}
            disabled={!input.trim() || sending}
            accessibilityLabel="Send"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, gap: 10 },
  listEmptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 28, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  emptySub: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 19 },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.red,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: '#fff', fontWeight: '500' },
  bubbleTextAssistant: { color: COLORS.text },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  loadingText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
