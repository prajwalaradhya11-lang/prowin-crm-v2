import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { SafeScreenHeader } from '../components/SafeScreenHeader';
import { useCrmSession } from '../hooks/useCrmSession';
import { postAiAssistant, type AiChatMessage } from '../lib/crmApi';
import { COLORS } from '../lib/supabase';

type ChatTurn = AiChatMessage & { id: string };

const LISTEN_TIMEOUT_MS = 10_000;
const GREETING = 'Hello Prowinner, how can I help?';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function stopSpeech() {
  try {
    void Speech.stop();
  } catch {
    // ignore
  }
}

function speakText(text: string) {
  const cleaned = text.trim();
  if (!cleaned) return;
  stopSpeech();
  Speech.speak(cleaned, { language: 'en-US' });
}

function stopRecognition() {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Native module missing (Expo Go) or already stopped
    }
  }
}

function isSttAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export default function AiAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { role, loading: sessionLoading } = useCrmSession();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceRepliesOn, setVoiceRepliesOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(false);
  const listRef = useRef<FlatList<ChatTurn>>(null);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetedRef = useRef(false);
  const voiceRepliesOnRef = useRef(voiceRepliesOn);
  const turnsRef = useRef(turns);
  const sendingRef = useRef(sending);
  const listeningRef = useRef(listening);
  const handledFinalRef = useRef(false);

  voiceRepliesOnRef.current = voiceRepliesOn;
  turnsRef.current = turns;
  sendingRef.current = sending;
  listeningRef.current = listening;

  const clearListenTimeout = useCallback(() => {
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearListenTimeout();
    stopRecognition();
    setListening(false);
  }, [clearListenTimeout]);

  useEffect(() => {
    setSttSupported(isSttAvailable());
    return () => {
      clearListenTimeout();
      stopRecognition();
      stopSpeech();
    };
  }, [clearListenTimeout]);

  useEffect(() => {
    if (turns.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [turns, sending]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sendingRef.current) return;

      stopListening();
      stopSpeech();

      const userTurn: ChatTurn = { id: newId(), role: 'user', content: text };
      const nextTurns = [...turnsRef.current, userTurn];
      setTurns(nextTurns);
      setInput('');
      setVoiceHint(null);
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

      if (voiceRepliesOnRef.current && result.ok) {
        speakText(replyText);
      }
    },
    [stopListening],
  );

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    clearListenTimeout();
    setListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    if (handledFinalRef.current) return;
    handledFinalRef.current = true;
    clearListenTimeout();
    setListening(false);
    const transcript = event.results?.[0]?.transcript?.trim() ?? '';
    if (!transcript) {
      setVoiceHint("Didn't catch that — try again.");
      return;
    }
    setInput(transcript);
    void sendMessage(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    clearListenTimeout();
    setListening(false);
    const code = event.error ?? '';
    if (code === 'aborted') return;
    if (code === 'no-speech') {
      setVoiceHint('No speech detected — tap the mic and try again.');
      return;
    }
    if (code === 'not-allowed') {
      setVoiceHint('Microphone permission denied.');
      return;
    }
    setVoiceHint("Couldn't hear you — try again.");
  });

  async function startListening() {
    if (sendingRef.current || listeningRef.current) return;

    if (!isSttAvailable()) {
      setSttSupported(false);
      setVoiceHint('Voice input needs a new app build (EAS). Text still works.');
      return;
    }

    stopSpeech();
    stopListening();
    setVoiceHint(null);
    handledFinalRef.current = false;

    if (voiceRepliesOnRef.current && !greetedRef.current) {
      greetedRef.current = true;
      speakText(GREETING);
    }

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceHint('Microphone permission denied.');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        maxAlternatives: 1,
      });
      setListening(true);

      listenTimeoutRef.current = setTimeout(() => {
        setVoiceHint('Listening timed out — tap the mic to try again.');
        stopListening();
      }, LISTEN_TIMEOUT_MS);
    } catch {
      setListening(false);
      setVoiceHint('Voice input unavailable — use the keyboard.');
    }
  }

  function onMicClick() {
    if (listening) {
      stopListening();
      setVoiceHint(null);
      return;
    }
    void startListening();
  }

  function toggleVoiceReplies() {
    setVoiceRepliesOn((prev) => {
      const next = !prev;
      if (!next) stopSpeech();
      return next;
    });
  }

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

  return (
    <View style={s.container}>
      <SafeScreenHeader
        title="AI Assistant"
        onBack={() => router.back()}
        rightContent={
          <TouchableOpacity
            onPress={toggleVoiceReplies}
            style={s.headerBtn}
            accessibilityLabel={voiceRepliesOn ? 'Turn off voice replies' : 'Turn on voice replies'}
            accessibilityState={{ selected: voiceRepliesOn }}
          >
            <Ionicons
              name={voiceRepliesOn ? 'volume-high' : 'volume-mute'}
              size={22}
              color={voiceRepliesOn ? COLORS.red : COLORS.muted}
            />
          </TouchableOpacity>
        }
      />

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

        <View style={[s.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {(voiceHint || listening) ? (
            <Text style={s.hint}>
              {listening ? 'Listening… speak your question.' : voiceHint}
            </Text>
          ) : null}
          <View style={s.composer}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask something…"
              placeholderTextColor={COLORS.mutedLight}
              multiline
              editable={!sending && !listening}
              onSubmitEditing={() => {
                void sendMessage(input);
              }}
            />
            <TouchableOpacity
              style={[
                s.micBtn,
                listening && s.micBtnActive,
                (!sttSupported || sending) && s.btnDisabled,
              ]}
              onPress={onMicClick}
              disabled={sending}
              accessibilityLabel={listening ? 'Stop listening' : 'Tap to talk'}
            >
              <Ionicons
                name="mic"
                size={20}
                color={listening ? '#fff' : sttSupported ? COLORS.text : COLORS.mutedLight}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || sending || listening) && s.btnDisabled]}
              onPress={() => {
                void sendMessage(input);
              }}
              disabled={!input.trim() || sending || listening}
              accessibilityLabel="Send"
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  hint: { fontSize: 12, color: COLORS.muted, marginBottom: 6, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
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
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
});
