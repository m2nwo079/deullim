import type { TaskInputs } from "../../core/reba-score";

/** The entry_tokens columns the check needs, or null when no row matches the token hash. */
export type EntryTokenRow = { active: boolean; expires_at: string } | null;

/** A token lets a worker in only if it exists, is active and has not expired. */
export function isEntryAllowed(row: EntryTokenRow, now: Date): boolean {
  return row !== null && row.active && new Date(row.expires_at) > now;
}

export type EntryTask = { id: string; name: string; inputs: TaskInputs };
export type EntryResponse = { workstationName: string; tasks: EntryTask[] };

/** tasks columns as stored (docs/data-model.md). */
export type TaskRow = {
  id: string;
  name: string;
  load_category: TaskInputs["loadCategory"];
  load_shock: boolean;
  coupling: TaskInputs["coupling"];
  static_hold: boolean;
  unstable_base: boolean;
  sitting: boolean;
  arm_supported: boolean;
};

/**
 * Task for the worker screen.
 * The manager inputs are returned only because stage C scores in the browser. Remove them from the
 * response in stage D, when the Route Handler recomputes the score on the server.
 */
export function toEntryTask(row: TaskRow): EntryTask {
  return {
    id: row.id,
    name: row.name,
    inputs: {
      loadCategory: row.load_category,
      loadShock: row.load_shock,
      coupling: row.coupling,
      staticHold: row.static_hold,
      unstableBase: row.unstable_base,
      sitting: row.sitting,
      armSupported: row.arm_supported,
    },
  };
}
