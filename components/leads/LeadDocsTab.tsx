import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';
import {
  type LeadDocument,
  formatFileSize,
  formatDocDate,
  getDocumentIconKind,
  createSignedDocumentUrl,
  documentPickerAvailable,
} from '../../lib/leadDocuments';

type LeadDocsTabProps = {
  documents: LeadDocument[];
  loading?: boolean;
  uploading?: boolean;
  onUpload: (displayName: string, source: 'document' | 'image') => Promise<void>;
  onDelete: (doc: LeadDocument) => Promise<void>;
  onRefresh?: () => void;
};

function docIcon(kind: ReturnType<typeof getDocumentIconKind>): {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
} {
  if (kind === 'image') return { name: 'image', color: THEME.red };
  if (kind === 'pdf') return { name: 'document', color: THEME.blue };
  if (kind === 'receipt') return { name: 'receipt', color: THEME.green };
  return { name: 'document-outline', color: THEME.meta };
}

export function LeadDocsTab({
  documents,
  loading,
  uploading,
  onUpload,
  onDelete,
}: LeadDocsTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadSource, setUploadSource] = useState<'document' | 'image'>('document');
  const pickers = documentPickerAvailable();

  function openUpload(source: 'document' | 'image') {
    if (source === 'document' && !pickers.document) {
      Alert.alert(
        'Package required',
        'Install expo-document-picker:\nnpx expo install expo-document-picker',
      );
      return;
    }
    if (source === 'image' && !pickers.image) {
      Alert.alert(
        'Package required',
        'Install expo-image-picker:\nnpx expo install expo-image-picker',
      );
      return;
    }
    setUploadSource(source);
    setUploadName('');
    setUploadOpen(true);
  }

  async function confirmUpload() {
    if (!uploadName.trim()) {
      Alert.alert('Name required', 'Enter a name for this document.');
      return;
    }
    try {
      await onUpload(uploadName.trim(), uploadSource);
      setUploadOpen(false);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Unknown error');
    }
  }

  async function openDocMenu(doc: LeadDocument) {
    Alert.alert(doc.file_name, undefined, [
      {
        text: 'View',
        onPress: async () => {
          const url = await createSignedDocumentUrl(doc.storage_path);
          if (url) Linking.openURL(url);
          else Alert.alert('Could not open file');
        },
      },
      {
        text: 'Download',
        onPress: async () => {
          const url = await createSignedDocumentUrl(doc.storage_path);
          if (url) Linking.openURL(url);
        },
      },
      {
        text: 'Share',
        onPress: async () => {
          const url = await createSignedDocumentUrl(doc.storage_path);
          if (url) Linking.openURL(url);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete document?', doc.file_name, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => onDelete(doc).catch(e =>
                Alert.alert('Delete failed', e.message),
              ),
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{documents.length} document{documents.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity onPress={() => openUpload('document')}>
          <Text style={s.uploadLink}>Upload</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.red} style={{ marginTop: 32 }} />
      ) : documents.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="folder-open-outline" size={40} color={THEME.border} />
          <Text style={s.emptyText}>No documents yet</Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const kind = getDocumentIconKind(item.file_type, item.file_name);
            const icon = docIcon(kind);
            const fmt = (item.file_type ?? 'file').split('/').pop()?.toUpperCase() ?? 'FILE';
            return (
              <View style={s.docCard}>
                <View style={[s.docIcon, { backgroundColor: `${icon.color}14` }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={s.docBody}>
                  <Text style={s.docName} numberOfLines={1}>{item.file_name}</Text>
                  <Text style={s.docMeta}>
                    {fmt} · {formatFileSize(item.size_bytes)} · {formatDocDate(item.created_at)}
                    {item.uploaded_by ? ` · ${item.uploaded_by}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openDocMenu(item)} hitSlop={8}>
                  <Ionicons name="ellipsis-vertical" size={18} color={THEME.meta} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={s.fab}
        onPress={() => Alert.alert('Upload', undefined, [
          { text: 'Document / PDF', onPress: () => openUpload('document') },
          { text: 'Photo', onPress: () => openUpload('image') },
          { text: 'Cancel', style: 'cancel' },
        ])}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      <Modal visible={uploadOpen} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Document name</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Passport copy"
              placeholderTextColor={THEME.meta}
              value={uploadName}
              onChangeText={setUploadName}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setUploadOpen(false)}>
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={confirmUpload} disabled={uploading}>
                <Text style={s.modalConfirmText}>{uploading ? 'Uploading…' : 'Upload'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 80 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: THEME.heading },
  uploadLink: { fontSize: 13, fontWeight: '700', color: THEME.red },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { fontSize: 14, color: THEME.meta },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
    marginBottom: 8,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBody: { flex: 1, minWidth: 0 },
  docName: { fontSize: 14, fontWeight: '700', color: THEME.heading },
  docMeta: { fontSize: 10, color: THEME.meta, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.red,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: THEME.heading, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: THEME.heading,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    alignItems: 'center',
  },
  modalCancel: { fontSize: 14, color: THEME.meta, fontWeight: '600' },
  modalConfirm: {
    backgroundColor: THEME.red,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
