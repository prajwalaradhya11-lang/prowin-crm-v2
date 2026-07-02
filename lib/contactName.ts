import { initialsFromPersonalName } from './leadName';

/** cold_call_contacts.name column is `full_name` (confirmed in schema). */
export type ContactNameFields = {
  full_name?: string | null;
  /** Defensive fallbacks if legacy/import columns exist on a row. */
  contact_name?: string | null;
  name?: string | null;
  phone?: string | null;
};

function getContactPersonalName(contact: ContactNameFields): string {
  const fullName = contact.full_name?.trim();
  if (fullName) return fullName;

  const contactName = contact.contact_name?.trim();
  if (contactName) return contactName;

  const name = contact.name?.trim();
  if (name) return name;

  return '';
}

/** full_name → contact_name/name → phone → "Unknown" */
export function getContactName(contact: ContactNameFields): string {
  const personal = getContactPersonalName(contact);
  if (personal) return personal;

  const phone = contact.phone?.trim();
  if (phone) return phone;

  return 'Unknown';
}

export function getContactInitials(contact: ContactNameFields): string | null {
  return initialsFromPersonalName(getContactPersonalName(contact));
}

export function contactHasPersonalName(contact: ContactNameFields): boolean {
  return Boolean(getContactPersonalName(contact));
}
