import { describe, expect, it } from "vitest";
import {
  consoleAccess,
  loginPathFor,
  partnersAccess,
  safeConsolePath,
  safePartnersPath,
  signInErrorKind,
  validateLoginFields,
} from "./rules";

describe("safeConsolePath", () => {
  it.each([
    ["/console", "/console"],
    ["/console/", "/console/"],
    ["/console/workstations?filter=high", "/console/workstations?filter=high"],
    ["/console/reports#draft", "/console/reports#draft"],
  ])("keeps the console path %s", (next, expected) => {
    expect(safeConsolePath(next)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "console",
    "https://evil.com/console",
    "//evil.com/console",
    "/\\evil.com",
    "\\\\evil.com",
    "/consoleX",
    "/preview/console",
    "/console/login",
    "/console/login?next=/console",
    "/console/../preview",
    "/console/./x/../../",
    "%2F%2Fevil.com",
    "%5Cevil.com",
    "/%2F%2Fevil.com",
    "/%5Cevil.com",
    "/console/%5C%5Cevil.com",
    "/console/%2E%2E/",
    "/console/%2e%2e/preview",
    "/console/%",
  ])("falls back to /console for %s", (next) => {
    expect(safeConsolePath(next)).toBe("/console");
  });
});

describe("safePartnersPath", () => {
  it.each([
    ["/partners", "/partners"],
    ["/partners/requests/abc?x=1", "/partners/requests/abc?x=1"],
  ])("keeps the partner path %s", (next, expected) => {
    expect(safePartnersPath(next)).toBe(expected);
  });

  it.each([
    "/console",
    "/partnersX",
    "/partners/login",
    "//evil.com/partners",
    "/partners/../console",
    "/partners/%2e%2e/console",
  ])("falls back to /partners for %s", (next) => {
    expect(safePartnersPath(next)).toBe("/partners");
  });
});

describe("loginPathFor", () => {
  it.each([
    ["/partners", "/partners/login"],
    ["/partners/requests/1", "/partners/login"],
    ["/console/qr", "/console/login"],
    ["/partnersX", "/console/login"],
  ])("sends %s to %s", (path, login) => {
    expect(loginPathFor(path)).toBe(login);
  });
});

describe("partnersAccess", () => {
  it("lets partners in", () => {
    expect(partnersAccess("partner")).toBe("partner");
  });

  it.each(["manager", "", null, undefined])("forbids %s", (role) => {
    expect(partnersAccess(role)).toBe("forbidden");
  });
});

describe("consoleAccess", () => {
  it("lets managers in", () => {
    expect(consoleAccess("manager")).toBe("manager");
  });

  it.each(["partner", "", null, undefined])("forbids %s", (role) => {
    expect(consoleAccess(role)).toBe("forbidden");
  });
});

describe("signInErrorKind", () => {
  it.each([400, 401, 403, 422])("uses one message for client error %i", (status) => {
    expect(signInErrorKind(status)).toBe("credentials");
  });

  it.each([429, 500, 502, 503, undefined])("asks to retry later for %s", (status) => {
    expect(signInErrorKind(status)).toBe("unavailable");
  });
});

describe("validateLoginFields", () => {
  it("passes a filled, well-formed form", () => {
    expect(validateLoginFields(" manager@example.com ", "secret")).toEqual({});
  });

  it("asks for both fields when empty", () => {
    expect(validateLoginFields("  ", "")).toEqual({
      email: "이메일을 입력해 주세요.",
      password: "비밀번호를 입력해 주세요.",
    });
  });

  it.each(["manager", "manager@", "@example.com", "manager@@example.com", "man ager@example.com"])(
    "asks to check the format of %s",
    (email) => {
      expect(validateLoginFields(email, "secret").email).toBe("이메일 형식을 확인해 주세요.");
    },
  );

  it("does not trim the password", () => {
    expect(validateLoginFields("manager@example.com", " ")).toEqual({});
  });
});
