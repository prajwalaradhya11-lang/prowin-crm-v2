import { View, Text, StyleSheet } from 'react-native';

export default function VoiceNote() {
  return (
    <View style={s.container}>
      <Text style={s.text}>Voice Note</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f7' },
  text: { fontSize: 16, color: '#1a1a2e' },
});