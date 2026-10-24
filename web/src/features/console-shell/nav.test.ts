import { describe, expect, it } from "vitest";
import { sectionOf, siteRedirect, siteSwitchTarget, withSite } from "./nav";

const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("sectionOf", () => {
  it("marks the overview only on /console itself", () => {
    expect(sectionOf("/console")?.key).toBe("overview");
    expect(sectionOf("/console/")?.key).toBe("overview");
  });

  it("marks second- and third-level screens with their section", () => {
    expect(sectionOf("/console/improvements")?.key).toBe("improvements");
    expect(sectionOf("/console/improvements/abc")?.key).toBe("improvements");
    expect(sectionOf("/console/improvements/abc/new")?.key).toBe("improvements");
    expect(sectionOf("/console/improvements/abc/def")?.key).toBe("improvements");
    expect(sectionOf("/console/requests/abc")?.key).toBe("requests");
    expect(sectionOf("/console/plans/abc")?.key).toBe("plans");
    expect(sectionOf("/console/surveys/new")?.key).toBe("surveys");
    expect(sectionOf("/console/reports")?.key).toBe("reports");
    expect(sectionOf("/console/qr")?.key).toBe("qr");
  });

  it("does not match a section by a shared prefix of its name", () => {
    expect(sectionOf("/console/qrcode")).toBeNull();
    expect(sectionOf("/console/login")).toBeNull();
  });
});

describe("withSite and siteSwitchTarget", () => {
  it("adds ?site= only when there is a site", () => {
    expect(withSite("/console/plans", SITE)).toBe(`/console/plans?site=${SITE}`);
    expect(withSite("/console/plans", undefined)).toBe("/console/plans");
  });

  it("goes to the section's first-level screen with only the new site", () => {
    expect(siteSwitchTarget("/console/reports", OTHER)).toBe(`/console/reports?site=${OTHER}`);
    expect(siteSwitchTarget("/console/improvements/abc/def", OTHER)).toBe(
      `/console/improvements?site=${OTHER}`,
    );
    expect(siteSwitchTarget("/console/requests/abc", OTHER)).toBe(
      `/console/requests?site=${OTHER}`,
    );
    expect(siteSwitchTarget("/console/surveys/new", OTHER)).toBe(`/console/surveys?site=${OTHER}`);
    expect(siteSwitchTarget("/console", OTHER)).toBe(`/console?site=${OTHER}`);
  });
});

describe("siteRedirect", () => {
  const path = "/console/requests/abc";

  it("does nothing when ?site= already names the object's site", () => {
    expect(siteRedirect(path, { site: SITE }, SITE)).toBeNull();
    expect(siteRedirect(path, { site: SITE, done: "request-created" }, SITE)).toBeNull();
  });

  it("sets the object's site when it is missing or another site", () => {
    expect(siteRedirect(path, {}, SITE)).toBe(`${path}?site=${SITE}`);
    expect(siteRedirect(path, { site: OTHER }, SITE)).toBe(`${path}?site=${SITE}`);
    expect(siteRedirect(path, { site: [SITE, OTHER] }, SITE)).toBe(`${path}?site=${SITE}`);
  });

  it("keeps other values such as the result code", () => {
    expect(siteRedirect(path, { done: "request-created", site: OTHER }, SITE)).toBe(
      `${path}?done=request-created&site=${SITE}`,
    );
  });

  it("does not redirect again from the address it returns", () => {
    const next = siteRedirect(path, { done: "plan-saved" }, SITE);
    const params = Object.fromEntries(new URL(`https://x${next}`).searchParams);
    expect(siteRedirect(path, params, SITE)).toBeNull();
  });
});
