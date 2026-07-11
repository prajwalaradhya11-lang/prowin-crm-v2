-- Lead detail Phase 2: secondary agent, re-assign stub, documents table
-- Run in Supabase SQL Editor. Create storage bucket manually (see bottom).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS secondary_agent_id uuid,
  ADD COLUMN IF NOT EXISTS secondary_agent_name text,
  ADD COLUMN IF NOT EXISTS reassign_pending_to_id uuid,
  ADD COLUMN IF NOT EXISTS reassign_pending_to_name text,
  ADD COLUMN IF NOT EXISTS reassign_pending_at timestamptz;

CREATE TABLE IF NOT EXISTS public.lead_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_type text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_documents_lead_id_idx ON public.lead_documents(lead_id);

-- ─── Storage bucket (Dashboard → Storage → New bucket) ─────────────────────
-- Name: lead-documents
-- Public: OFF (private)
-- Allowed MIME: image/*, application/pdf
--
-- Example policy (authenticated upload/read own org — tighten when RLS is enabled):
-- CREATE POLICY "auth upload lead docs" ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'lead-documents');
-- CREATE POLICY "auth read lead docs" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'lead-documents');
