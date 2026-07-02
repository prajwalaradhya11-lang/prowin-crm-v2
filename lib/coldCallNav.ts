let navContactIds: string[] = [];

export function setColdCallNavIds(ids: string[]) {
  navContactIds = ids;
}

export function getColdCallNavIds(): string[] {
  return navContactIds;
}

export function getAdjacentContactId(currentId: string, direction: -1 | 1): string | null {
  const idx = navContactIds.indexOf(currentId);
  if (idx < 0) return null;
  const next = idx + direction;
  if (next < 0 || next >= navContactIds.length) return null;
  return navContactIds[next];
}

export function getContactNavIndex(currentId: string): number {
  return navContactIds.indexOf(currentId);
}
