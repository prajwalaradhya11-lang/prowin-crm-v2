import { supabase } from './supabase';
import { format } from 'date-fns';

export const LEAD_DOCUMENTS_BUCKET = 'lead-documents';

export type LeadDocument = {
  id: string;
  lead_id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string | null;
};

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDocumentIconKind(fileType: string | null | undefined, fileName: string): 'image' | 'pdf' | 'receipt' | 'other' {
  const t = (fileType ?? '').toLowerCase();
  const n = fileName.toLowerCase();
  if (t.includes('image') || n.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
  if (t.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (n.includes('receipt') || n.includes('invoice')) return 'receipt';
  return 'other';
}

export async function fetchLeadDocuments(leadId: string): Promise<LeadDocument[]> {
  const { data, error } = await supabase
    .from('lead_documents')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[lead_documents] fetch error', error.message);
    return [];
  }
  return (data ?? []) as LeadDocument[];
}

export async function createSignedDocumentUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(LEAD_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.warn('[lead_documents] signed url error', error.message);
    return null;
  }
  return data.signedUrl;
}

export async function uploadLeadDocument(
  leadId: string,
  file: PickedFile,
  displayName: string,
  uploadedBy: string,
): Promise<LeadDocument> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const storagePath = `${leadId}/${Date.now()}-${displayName.replace(/[^\w.-]+/g, '_')}.${ext}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(LEAD_DOCUMENTS_BUCKET)
    .upload(storagePath, blob, {
      contentType: file.mimeType ?? 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('lead_documents')
    .insert({
      lead_id: leadId,
      file_name: displayName.trim(),
      storage_path: storagePath,
      file_type: file.mimeType,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as LeadDocument;
}

export async function deleteLeadDocument(doc: LeadDocument): Promise<void> {
  await supabase.storage.from(LEAD_DOCUMENTS_BUCKET).remove([doc.storage_path]);
  const { error } = await supabase.from('lead_documents').delete().eq('id', doc.id);
  if (error) throw error;
}

export function formatDocDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

/** Returns true when expo-document-picker is available. */
export async function pickDocumentFile(): Promise<PickedFile | null> {
  try {
    const DocumentPicker = require('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*'],
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    };
  } catch (e) {
    throw new Error('expo-document-picker is not installed. Run: npx expo install expo-document-picker');
  }
}

export async function pickImageFile(): Promise<PickedFile | null> {
  try {
    const ImagePicker = require('expo-image-picker');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Photo library permission denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
    return {
      uri: asset.uri,
      name,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? null,
    };
  } catch (e: any) {
    if (e?.message?.includes('not installed')) throw e;
    throw new Error('expo-image-picker is not installed. Run: npx expo install expo-image-picker');
  }
}

export function documentPickerAvailable(): { document: boolean; image: boolean } {
  let document = false;
  let image = false;
  try {
    require.resolve('expo-document-picker');
    document = true;
  } catch { /* not installed */ }
  try {
    require.resolve('expo-image-picker');
    image = true;
  } catch { /* not installed */ }
  return { document, image };
}
