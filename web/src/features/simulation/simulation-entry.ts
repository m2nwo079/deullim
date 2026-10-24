import type { SessionResult } from "../../core/reba-session";
import type { SimulationEffect } from "../../core/simulation-effect";

/** What the phone sees after scanning a simulation QR: names only. */
export type SimulationEntry = {
  optionTitle: string;
  workstationName: string;
  task: { id: string; name: string };
};

/** The server-computed capture and the effect it saved. */
export type SimulationResponse = {
  result: Extract<SessionResult, { ok: true }>;
  effect: SimulationEffect;
};
