/** What the server said to a capture: the status and the error code in the JSON body, if any. */
export type SendAnswer = { status: number; error: string | null };

export type SendOutcome =
  | "saved"
  // /w 429: the hourly limit was reached; the result is shown but was not saved.
  | "not-saved"
  | "insufficient"
  | "rejected"
  // /s: a used token right after a try with no answer; that try was most likely saved.
  | "maybe-saved"
  // Nothing was saved, so the same capture may be sent again.
  | "retry"
  // /s: no answer; sending again is safe because the one-time token blocks a second save.
  | "retry-no-answer"
  // /w: no answer or an unexpected one; it may have been saved, so only a retake is offered.
  | "unknown";

/**
 * Sorts the answer to a capture into the screen that follows (docs/components.md "상태 표시").
 * answer is null when no answer came (network error). /w sends again only when the server said
 * "unavailable" (503): save_assessment runs in one transaction, so an error saved nothing.
 * /s may always send again: save_simulation_capture locks and spends the one-time token.
 */
export function sendOutcome(
  flow: "worker" | "simulation",
  answer: SendAnswer | null,
  afterNoAnswer = false,
): SendOutcome {
  if (answer === null) {
    return flow === "worker" ? "unknown" : "retry-no-answer";
  }
  const { status, error } = answer;
  if (status >= 200 && status < 300) {
    return "saved";
  }
  if (status === 401) {
    return flow === "simulation" && afterNoAnswer ? "maybe-saved" : "rejected";
  }
  if (status === 422) {
    return "insufficient";
  }
  if (flow === "worker" && status === 429) {
    return "not-saved";
  }
  if (flow === "simulation") {
    return afterNoAnswer ? "retry-no-answer" : "retry";
  }
  return status === 503 && error === "unavailable" ? "retry" : "unknown";
}

/** Reads the error code of a failed answer; bodies that are not JSON count as no code. */
export async function readError(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
