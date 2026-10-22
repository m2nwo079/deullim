export const CONSOLE_HOME = "/console";

/** Form values are strings for text inputs; anything else (a file) counts as empty. */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
export const CONSOLE_LOGIN = "/console/login";

const BASE = "http://localhost";

/**
 * Returns the path to open after sign-in. Only same-site paths under /console are kept;
 * anything else (other origins, protocol-relative or backslash tricks, encoded or plain
 * dot segments, the login page itself) falls back to /console.
 */
export function safeConsolePath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return CONSOLE_HOME;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return CONSOLE_HOME;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || /(^|\/)\.\.?(\/|$)/.test(decoded)) {
    return CONSOLE_HOME;
  }

  const url = new URL(next, BASE);
  const path = url.pathname;
  const underConsole = path === CONSOLE_HOME || path.startsWith(`${CONSOLE_HOME}/`);
  const isLogin = path === CONSOLE_LOGIN || path.startsWith(`${CONSOLE_LOGIN}/`);
  if (url.origin !== BASE || !underConsole || isLogin) {
    return CONSOLE_HOME;
  }
  return `${path}${url.search}${url.hash}`;
}

export type ConsoleAccess = "manager" | "forbidden";

/** Only manager profiles may enter the console. A missing profile is forbidden too. */
export function consoleAccess(role: string | null | undefined): ConsoleAccess {
  return role === "manager" ? "manager" : "forbidden";
}

export type SignInError = "credentials" | "unavailable" | "forbidden";

/**
 * Maps a Supabase Auth error status to the message kind shown on the login screen.
 * 4xx answers share one message so the screen never reveals whether an account exists.
 * Rate limiting (429), server errors and network failures (no status) get a separate
 * "try again later" message, so a manager does not keep retrying a correct password.
 */
export function signInErrorKind(status: number | undefined): Exclude<SignInError, "forbidden"> {
  return status !== undefined && status >= 400 && status < 500 && status !== 429
    ? "credentials"
    : "unavailable";
}

// Same rule as the HTML email input type, so the result matches what browsers accept.
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export type LoginFieldErrors = { email?: string; password?: string };

/** Checks the login form before it is sent. The server checks again; this only guides the user. */
export function validateLoginFields(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const trimmed = email.trim();
  if (!trimmed) {
    errors.email = "이메일을 입력해 주세요.";
  } else if (!EMAIL_PATTERN.test(trimmed)) {
    errors.email = "이메일 형식을 확인해 주세요.";
  }
  if (!password) {
    errors.password = "비밀번호를 입력해 주세요.";
  }
  return errors;
}
