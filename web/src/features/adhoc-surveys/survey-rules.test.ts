import { describe, expect, it } from "vitest";
import {
  alertFromWeek,
  completedOnError,
  daysLeft,
  daysLeftLabel,
  dueDateFor,
  isOccurredOnAllowed,
  painAlerts,
  parseSurveyForm,
  recentDoneFrom,
  todayKst,
  type AlertPainRow,
} from "./survey-rules";

// Friday 2026-10-23, 14:00 in Seoul. This week starts on Monday 2026-10-19.
const NOW = new Date("2026-10-23T05:00:00Z");

describe("dueDateFor", () => {
  it("ends the day before the same day of the next month", () => {
    expect(dueDateFor("2026-10-14")).toBe("2026-11-14");
    expect(dueDateFor("2026-12-31")).toBe("2027-01-31");
  });

  it("ends on the month's last day when the next month has no such day", () => {
    expect(dueDateFor("2027-01-30")).toBe("2027-02-28");
    expect(dueDateFor("2028-01-30")).toBe("2028-02-29");
    expect(dueDateFor("2027-03-30")).toBe("2027-04-30");
  });

  it("counts a whole month when counting starts on the first", () => {
    expect(dueDateFor("2027-02-28")).toBe("2027-03-31");
    expect(dueDateFor("2027-01-31")).toBe("2027-02-28");
    expect(dueDateFor("2028-01-31")).toBe("2028-02-29");
  });

  it("stays within the 31 days the database allows", () => {
    const day = 24 * 60 * 60 * 1000;
    for (let t = Date.UTC(2027, 0, 1); t < Date.UTC(2029, 0, 1); t += day) {
      const occurred = new Date(t).toISOString().slice(0, 10);
      const span = (Date.parse(dueDateFor(occurred)) - t) / day;
      expect(span).toBeGreaterThanOrEqual(28);
      expect(span).toBeLessThanOrEqual(31);
    }
  });

  it("rejects dates that do not exist", () => {
    expect(() => dueDateFor("2026-02-30")).toThrow();
  });
});

describe("isOccurredOnAllowed", () => {
  it("accepts today and earlier in Seoul, not tomorrow", () => {
    expect(isOccurredOnAllowed("2026-10-23", NOW)).toBe(true);
    expect(isOccurredOnAllowed("2026-01-01", NOW)).toBe(true);
    expect(isOccurredOnAllowed("2026-10-24", NOW)).toBe(false);
  });

  it("uses the Seoul date around midnight", () => {
    // 2026-10-23 23:59:59 and 2026-10-24 00:00:00 in Seoul.
    const beforeMidnight = new Date("2026-10-23T14:59:59Z");
    const afterMidnight = new Date("2026-10-23T15:00:00Z");
    expect(isOccurredOnAllowed("2026-10-24", beforeMidnight)).toBe(false);
    expect(isOccurredOnAllowed("2026-10-24", afterMidnight)).toBe(true);
    // Early morning in Seoul is still the previous day in UTC.
    expect(isOccurredOnAllowed("2026-10-24", new Date("2026-10-23T16:00:00Z"))).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    expect(isOccurredOnAllowed("2026-02-30", NOW)).toBe(false);
    expect(isOccurredOnAllowed("2026-10-1", NOW)).toBe(false);
    expect(isOccurredOnAllowed("", NOW)).toBe(false);
  });
});

describe("daysLeft", () => {
  it("counts days from today in Seoul", () => {
    expect(todayKst(NOW)).toBe("2026-10-23");
    expect(daysLeft("2026-10-30", NOW)).toBe(7);
    expect(daysLeft("2026-10-23", NOW)).toBe(0);
    expect(daysLeft("2026-10-20", NOW)).toBe(-3);
    expect(daysLeft("2026-10-24", new Date("2026-10-23T15:00:00Z"))).toBe(0);
  });

  it("labels the remaining days", () => {
    expect([daysLeftLabel(3), daysLeftLabel(0), daysLeftLabel(-2)]).toEqual([
      "D-3",
      "오늘까지",
      "기한 지남 2일",
    ]);
  });
});

describe("painAlerts", () => {
  const workstations = [
    { id: "weld", parentGroup: "차체" },
    { id: "press", parentGroup: "차체" },
    { id: "dock", parentGroup: "물류" },
    { id: "pack", parentGroup: "물류" },
    { id: "qc", parentGroup: "품질" },
  ];
  const row = (
    over: Partial<AlertPainRow> & Pick<AlertPainRow, "weekStart" | "moderateCount">,
  ): AlertPainRow => ({
    workstationId: "weld",
    parentGroup: "차체",
    label: "용접 3번 작업대",
    merged: false,
    severeCount: 0,
    verySevereCount: 0,
    ...over,
  });
  const group = (weekStart: string, moderateCount: number): AlertPainRow =>
    row({
      workstationId: null,
      parentGroup: "물류",
      label: "물류",
      merged: true,
      weekStart,
      moderateCount,
    });
  const base = {
    workstations,
    visibleGroups: ["차체", "물류"],
    openSurveyWorkstationIds: [] as string[],
    now: NOW,
  };

  it("covers this week and the three before it", () => {
    expect(alertFromWeek(NOW)).toBe("2026-09-28");
    // Sunday night in Seoul still belongs to the week of 2026-10-19.
    expect(alertFromWeek(new Date("2026-10-25T14:59:59Z"))).toBe("2026-09-28");
    expect(alertFromWeek(new Date("2026-10-25T15:00:00Z"))).toBe("2026-10-05");
  });

  it("alerts from three moderate or worse reports, not two", () => {
    const two = painAlerts({
      ...base,
      painRows: [row({ weekStart: "2026-10-19", moderateCount: 1, severeCount: 1 })],
    });
    expect(two).toEqual([]);
    const three = painAlerts({
      ...base,
      painRows: [
        row({ weekStart: "2026-09-28", moderateCount: 1 }),
        row({ weekStart: "2026-10-19", moderateCount: 0, severeCount: 1, verySevereCount: 1 }),
      ],
    });
    expect(three).toEqual([
      {
        label: "용접 3번 작업대",
        merged: false,
        parentGroup: "차체",
        workstationIds: ["weld"],
        reportCount: 3,
        openSurveyWorkstationId: null,
      },
    ]);
  });

  it("ignores mild reports and weeks before the window", () => {
    const alerts = painAlerts({
      ...base,
      painRows: [
        row({ weekStart: "2026-09-21", moderateCount: 5 }),
        row({ weekStart: "2026-10-19", moderateCount: 2 }),
      ],
    });
    expect(alerts).toEqual([]);
  });

  it("alerts a merged group by its name with every workstation of the group", () => {
    const alerts = painAlerts({
      ...base,
      painRows: [group("2026-10-12", 2), group("2026-10-19", 1)],
      openSurveyWorkstationIds: ["pack"],
    });
    expect(alerts).toEqual([
      {
        label: "물류",
        merged: true,
        parentGroup: "물류",
        workstationIds: ["dock", "pack"],
        reportCount: 3,
        openSurveyWorkstationId: "pack",
      },
    ]);
  });

  it("drops hidden groups and workstations of other sites", () => {
    const alerts = painAlerts({
      ...base,
      painRows: [
        row({
          workstationId: null,
          parentGroup: "품질",
          label: "품질",
          merged: true,
          weekStart: "2026-10-19",
          moderateCount: 9,
        }),
        row({ workstationId: "other", weekStart: "2026-10-19", moderateCount: 9 }),
      ],
    });
    expect(alerts).toEqual([]);
  });

  it("orders by report count", () => {
    const alerts = painAlerts({
      ...base,
      painRows: [row({ weekStart: "2026-10-19", moderateCount: 3 }), group("2026-10-19", 4)],
    });
    expect(alerts.map((a) => a.label)).toEqual(["물류", "용접 3번 작업대"]);
  });
});

describe("parseSurveyForm", () => {
  const id = "6fcb6c88-b8db-424f-91cd-f8e22bab67e5";
  const text = { workstationId: id, reason: "new_work", occurredOn: "2026-10-23", note: "  " };

  it("accepts an occurrence today and computes the due date", () => {
    expect(parseSurveyForm(text, NOW)).toEqual({
      ok: true,
      values: {
        workstationId: id,
        reason: "new_work",
        occurredOn: "2026-10-23",
        dueDate: "2026-11-23",
        note: null,
      },
    });
  });

  it("rejects tomorrow, an unknown reason, a bad id and a long note", () => {
    expect(
      parseSurveyForm(
        {
          workstationId: "x",
          reason: "신고 누적",
          occurredOn: "2026-10-24",
          note: "가".repeat(501),
        },
        NOW,
      ),
    ).toEqual({
      ok: false,
      errors: {
        workstationId: "공정을 골라 주세요.",
        reason: "사유를 골라 주세요.",
        occurredOn: "오늘이나 그 이전 날짜를 입력해 주세요.",
        note: "메모는 500자 이하로 적어 주세요.",
      },
    });
  });

  it("counts the note in characters, not UTF-16 units", () => {
    const emoji = String.fromCodePoint(0x1f600);
    expect(parseSurveyForm({ ...text, note: emoji.repeat(500) }, NOW).ok).toBe(true);
    expect(parseSurveyForm({ ...text, note: emoji.repeat(501) }, NOW).ok).toBe(false);
  });
});

describe("completedOnError", () => {
  it("allows the occurrence date through today", () => {
    expect(completedOnError("2026-10-14", "2026-10-14", NOW)).toBeNull();
    expect(completedOnError("2026-10-23", "2026-10-14", NOW)).toBeNull();
    expect(completedOnError("2026-10-13", "2026-10-14", NOW)).toBe(
      "완료일은 발생일과 같거나 그 뒤여야 해요.",
    );
    expect(completedOnError("2026-10-24", "2026-10-14", NOW)).toBe(
      "오늘이나 그 이전 날짜를 입력해 주세요.",
    );
  });
});

describe("recentDoneFrom", () => {
  it("goes one year back from today in Seoul", () => {
    expect(recentDoneFrom(NOW)).toBe("2025-10-23");
    expect(recentDoneFrom(new Date("2026-10-23T15:00:00Z"))).toBe("2025-10-24");
  });
});
