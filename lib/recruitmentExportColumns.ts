import type { ExportColumn } from './exportDownload';
import type { RecruitmentExportRow } from './fetchAllRecruitment';

function formatCreatedDate(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
}

/** Mirrors web RECRUITMENT_EXPORT_COLUMNS headers. */
export const RECRUITMENT_EXPORT_COLUMNS: ExportColumn<RecruitmentExportRow>[] = [
  { key: 'candidateName', header: 'Candidate Name', value: (row) => row.candidate_name ?? '' },
  { key: 'phone', header: 'Phone', value: (row) => row.phone ?? '' },
  { key: 'email', header: 'Email', value: (row) => row.email ?? '' },
  { key: 'positionApplied', header: 'Position Applied', value: (row) => row.position_applied ?? '' },
  { key: 'callStatus', header: 'Status', value: (row) => row.call_status?.trim() || 'New' },
  {
    key: 'assignedRecruiter',
    header: 'Assigned Recruiter',
    value: (row) => row.assigned_recruiter_name?.trim() || '',
  },
  { key: 'addedBy', header: 'Added By', value: (row) => row.added_by_name?.trim() || '' },
  {
    key: 'createdAt',
    header: 'Created date',
    value: (row) => formatCreatedDate(row.created_at),
  },
  { key: 'cvLink', header: 'CV link', value: (row) => row.cv_url?.trim() || '' },
];
