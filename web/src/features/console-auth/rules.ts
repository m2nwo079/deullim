export const CONSOLE_HOME = "/console";

/** Form values are strings for text inputs; anything else (a file) counts as empty. */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
export const CONSOLE_LOGIN = "/console/login";
export const PARTNERS_HOME = "/partners";
export const PARTNERS_LOGIN = "/partners/login";
/** The one sign-in page for managers and partners; the role picks where to go next. */
export const LOGIN = "/login";

const BASE = "http://localhost";

/**
 * Returns the path to open after sign-in. Only same-site paths under home are kept; anything
 * else (other origins, protocol-relative or backslash tricks, encoded or plain dot segments,
 * the login page itself) falls back to home. A ?done= result notice is dropped, so it does not
 * show again after sign-in.
 */
function safePathUnder(next: string | null | undefined, home: string, login: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return home;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return home;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || /(^|\/)\.\.?(\/|$)/.test(decoded)) {
    return home;
  }

  const url = new URL(next, BASE);
  const path = url.pathname;
  const underHome = path === home || path.startsWith(`${home}/`);
  const isLogin = path === login || path.startsWith(`${login}/`);
  if (url.origin !== BASE || !underHome || isLogin) {
    return home;
  }
  if (url.searchParams.has("done")) {
    url.searchParams.delete("done");
  }
  return `${path}${url.search}${url.hash}`;
}

export function safeConsolePath(next: string | null | undefined): string {
  return safePathUnder(next, CONSOLE_HOME, CONSOLE_LOGIN);
}

export function safePartnersPath(next: string | null | undefined): string {
  return safePathUnder(next, PARTNERS_HOME, PARTNERS_LOGIN);
}

/**
 * Where a signed-in account goes: managers stay under /console, partners under /partners, and
 * a next path outside the role's area falls back to its home. Null for any other role, which
 * is signed out.
 */
export function signedInPath(
  role: string | null | undefined,
  next: string | null | undefined,
): string | null {
  if (role === "manager") {
    return safeConsolePath(next);
  }
  if (role === "partner") {
    return safePartnersPath(next);
  }
  return null;
}

export type ConsoleAccess = "manager" | "forbidden";

/** Only manager profiles may enter the console. A missing profile is forbidden too. */
export function consoleAccess(role: string | null | undefined): ConsoleAccess {
  return role === "manager" ? "manager" : "forbidden";
}

export type PartnersAccess = "partner" | "forbidden";

/** Only partner profiles may enter 들림 파트너스; managers are turned away too. */
export function partnersAccess(role: string | null | undefined): PartnersAccess {
  return role === "partner" ? "partner" : "forbidden";
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
