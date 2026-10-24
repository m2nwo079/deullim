// Result codes passed in ?done= after a save or delete moves to another screen. The address
// carries only the code; the arriving screen picks the sentence (docs/components.md "이동").

const MESSAGES = {
  "option-added": "개선안을 추가했어요.",
  "option-saved": "개선안을 저장했어요.",
  "request-created": "견적 요청 초안을 만들었어요. 내용을 확인한 뒤 공개해 주세요.",
  "request-exists": "이 개선안은 이미 진행 중인 요청이 있어 그 요청을 열었어요.",
  "request-opened": "요청을 공개했어요. 이제 설비 업체가 견적을 낼 수 있어요.",
  "request-deleted": "요청 초안을 지웠어요.",
  "survey-started": "수시 조사를 기록했어요.",
  "plan-saved": "개선 계획을 저장했어요.",
  "plan-saved-recalculated": "계산 이후 데이터가 바뀌어 다시 계산한 결과로 저장했어요.",
} as const;

export type DoneCode = keyof typeof MESSAGES;

/** Codes each arriving screen accepts; any other code is ignored there. */
const SCREENS = {
  workstation: ["option-added", "option-saved"],
  request: ["request-created", "request-exists", "request-opened"],
  requests: ["request-deleted"],
  surveys: ["survey-started"],
  plan: ["plan-saved", "plan-saved-recalculated"],
} as const satisfies Record<string, readonly DoneCode[]>;

export type DoneScreen = keyof typeof SCREENS;

/** Sentence for ?done= on this screen, or null for a missing, unknown or foreign code. */
export function doneMessage(
  screen: DoneScreen,
  value: string | string[] | undefined,
): string | null {
  const code = Array.isArray(value) ? value[0] : value;
  const accepted: readonly string[] = SCREENS[screen];
  return code !== undefined && accepted.includes(code) ? MESSAGES[code as DoneCode] : null;
}

/** Adds ?done= to a path that may already have a query. */
export function withDone(path: string, code: DoneCode): string {
  return `${path}${path.includes("?") ? "&" : "?"}done=${code}`;
}
