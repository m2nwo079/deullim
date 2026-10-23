/** The entry_tokens columns the check needs, or null when no row matches the token hash. */
export type EntryTokenRow = { active: boolean; expires_at: string } | null;

/** A token lets a worker in only if it exists, is active and has not expired. */
export function isEntryAllowed(row: EntryTokenRow, now: Date): boolean {
  return row !== null && row.active && new Date(row.expires_at) > now;
}

export type EntryTask = { id: string; name: string };
export type EntryResponse = { workstationName: string; tasks: EntryTask[] };
