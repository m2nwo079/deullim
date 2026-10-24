import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, type Landmark, type PoseFrame } from "./landmarks";
import { optionReduction, type OptimizerWorkstation } from "./optimizer";
import { assessSession } from "./reba-session";
import type { TaskInputs } from "./reba-score";

// The demo site (tests/fixtures/demo_data_v1.json) is scored here with the real session code, and
// the result is the generated part of supabase/demo-data.sql. The test fails when the SQL differs;
// DEMO_SQL_WRITE=1 rewrites it (docs/deployment.md, 시연 데이터).

type FixtureInputs = {
  load_category: TaskInputs["loadCategory"];
  load_shock: boolean;
  coupling: TaskInputs["coupling"];
  static_hold: boolean;
  unstable_base: boolean;
  sitting: boolean;
  arm_supported: boolean;
};
type DemoFixture = {
  site_name: string;
  fps: number;
  workstations: { code: string; parent_group: string; name: string; headcount: number }[];
  tasks: {
    code: string;
    name: string;
    daily_hours: number;
    inputs: FixtureInputs;
    session: { days_ago: number; segments: { posture: string | null; seconds: number }[] } | null;
    expected_level: string | null;
  }[];
  options: {
    code: string;
    title: string;
    description: string | null;
    cost: number;
    effects: { task: string; expected_high_risk_ratio: number }[];
  }[];
};
type PostureFixture = {
  cases: {
    name: string;
    width: number;
    height: number;
    landmarks: Record<string, [number, number]>;
  }[];
};

const fixtureUrl = (name: string) => new URL(`../../../tests/fixtures/${name}`, import.meta.url);
const demo = JSON.parse(readFileSync(fixtureUrl("demo_data_v1.json"), "utf8")) as DemoFixture;
const postures = JSON.parse(
  readFileSync(fixtureUrl("reba_postures_v1.json"), "utf8"),
) as PostureFixture;

const SIZE = 1000;
const EMPTY: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({
  x: 0,
  y: 0,
  visibility: 0,
}));

function landmarks(posture: string | null): Landmark[] {
  if (posture === null) {
    return EMPTY;
  }
  const found = postures.cases.find((c) => c.name === posture);
  if (!found || found.width !== SIZE || found.height !== SIZE) {
    throw new Error(`no ${SIZE}x${SIZE} posture named ${posture}`);
  }
  return Array.from({ length: LANDMARK_COUNT }, (_, i) => {
    const p = found.landmarks[String(i)];
    return p ? { x: p[0], y: p[1], visibility: 1 } : { x: 0, y: 0, visibility: 0 };
  });
}

function toInputs(i: FixtureInputs): TaskInputs {
  return {
    loadCategory: i.load_category,
    loadShock: i.load_shock,
    coupling: i.coupling,
    staticHold: i.static_hold,
    unstableBase: i.unstable_base,
    sitting: i.sitting,
    armSupported: i.arm_supported,
  };
}

/** Each posture held for its seconds at the fixture's frame rate; null is a frame without a body. */
function session(task: DemoFixture["tasks"][number]) {
  if (task.session === null) {
    return null;
  }
  const frames: PoseFrame[] = [];
  for (const segment of task.session.segments) {
    const points = landmarks(segment.posture);
    for (let i = 0; i < segment.seconds * demo.fps; i++) {
      frames.push({ t: frames.length / demo.fps, landmarks: points });
    }
  }
  const result = assessSession({ width: SIZE, height: SIZE, frames }, toInputs(task.inputs));
  if (!result.ok) {
    throw new Error(`${task.code} ${task.name}: ${result.reason}`);
  }
  return { frameCount: frames.length, daysAgo: task.session.days_ago, result };
}

const scored = demo.tasks.map((task) => ({ task, scored: session(task) }));

const text = (value: string | null) =>
  value === null ? "null" : `'${value.replaceAll("'", "''")}'`;
const rows = (values: string[][]) => values.map((row) => `  (${row.join(", ")})`).join(",\n");
const SITE_JOIN = "join public.sites s on s.name = current_setting('demo.site_name')";
const WORKSTATION_JOIN = "join public.workstations w on w.site_id = s.id and w.code = v.code";

function structureSql(): string {
  const assessed = scored.flatMap(({ task, scored: s }) => (s ? [{ task, s }] : []));
  return `insert into public.workstations (site_id, parent_group, name, code, headcount)
select s.id, v.parent_group, v.name, v.code, v.headcount
from (values
${rows(demo.workstations.map((w) => [text(w.parent_group), text(w.name), text(w.code), String(w.headcount)]))}
) as v (parent_group, name, code, headcount)
${SITE_JOIN};

insert into public.tasks (
  workstation_id, name, daily_hours, load_category, load_shock, coupling,
  static_hold, unstable_base, sitting, arm_supported
)
select w.id, v.name, v.daily_hours, v.load_category, v.load_shock, v.coupling,
  v.static_hold, v.unstable_base, v.sitting, v.arm_supported
from (values
${rows(
  demo.tasks.map((t) => [
    text(t.code),
    text(t.name),
    String(t.daily_hours),
    text(t.inputs.load_category),
    String(t.inputs.load_shock),
    text(t.inputs.coupling),
    String(t.inputs.static_hold),
    String(t.inputs.unstable_base),
    String(t.inputs.sitting),
    String(t.inputs.arm_supported),
  ]),
)}
) as v (
  code, name, daily_hours, load_category, load_shock, coupling,
  static_hold, unstable_base, sitting, arm_supported
)
${SITE_JOIN}
${WORKSTATION_JOIN};

-- One capture session per assessed task, then its assessment as the server would store it.
insert into public.capture_sessions (task_id, frame_count, inference_fps, created_at)
select t.id, v.frame_count, v.inference_fps, now() - make_interval(days => v.days_ago)
from (values
${rows(assessed.map(({ task, s }) => [text(task.code), text(task.name), String(s.frameCount), String(demo.fps), String(s.daysAgo)]))}
) as v (code, task, frame_count, inference_fps, days_ago)
${SITE_JOIN}
${WORKSTATION_JOIN}
join public.tasks t on t.workstation_id = w.id and t.name = v.task;

insert into public.assessments (
  session_id, method, part_summary, valid_frame_ratio, high_risk_ratio, score_p90, level,
  algorithm_version, created_at
)
select c.id, 'reba', v.part_summary::jsonb, v.valid_frame_ratio, v.high_risk_ratio, v.score_p90,
  v.level, v.algorithm_version, c.created_at
from (values
${rows(
  assessed.map(({ task, s }) => [
    text(task.code),
    text(task.name),
    text(JSON.stringify(s.result.partSummary)),
    String(s.result.validFrameRatio),
    String(s.result.highRiskRatio),
    String(s.result.scoreP90),
    text(s.result.level),
    text(s.result.algorithmVersion),
  ]),
)}
) as v (code, task, part_summary, valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version)
${SITE_JOIN}
${WORKSTATION_JOIN}
join public.tasks t on t.workstation_id = w.id and t.name = v.task
join public.capture_sessions c on c.task_id = t.id;

insert into public.improvement_options (workstation_id, title, description, cost)
select w.id, v.title, v.description, v.cost
from (values
${rows(demo.options.map((o) => [text(o.code), text(o.title), o.description === null ? "null::text" : text(o.description), String(o.cost)]))}
) as v (code, title, description, cost)
${SITE_JOIN}
${WORKSTATION_JOIN};

insert into public.option_effects (option_id, task_id, expected_high_risk_ratio, source)
select o.id, t.id, v.expected_high_risk_ratio, 'manual'
from (values
${rows(
  demo.options.flatMap((o) =>
    o.effects.map((e) => [
      text(o.code),
      text(o.title),
      text(e.task),
      String(e.expected_high_risk_ratio),
    ]),
  ),
)}
) as v (code, title, task, expected_high_risk_ratio)
${SITE_JOIN}
${WORKSTATION_JOIN}
join public.improvement_options o on o.workstation_id = w.id and o.title = v.title
join public.tasks t on t.workstation_id = w.id and t.name = v.task;`;
}

const siteNameSql = `select set_config('demo.site_name', ${text(demo.site_name)}, true);`;

/** The lines between the section's BEGIN and END markers; rewritten when DEMO_SQL_WRITE is set. */
function generatedSection(file: string, name: string, expected: string): string {
  const url = new URL(`../../../supabase/${file}`, import.meta.url);
  const source = readFileSync(url, "utf8");
  const begin = `-- BEGIN GENERATED: ${name}\n`;
  const end = `-- END GENERATED: ${name}`;
  const from = source.indexOf(begin);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0 || source.indexOf(begin, from + 1) >= 0) {
    throw new Error(`${file} needs exactly one "${name}" section`);
  }
  const body = `${expected}\n`;
  if (process.env.DEMO_SQL_WRITE === "1") {
    writeFileSync(url, source.slice(0, from + begin.length) + body + source.slice(to));
    return body;
  }
  return source.slice(from + begin.length, to);
}

describe("demo data (tests/fixtures/demo_data_v1.json)", () => {
  it("scores every session at its intended level", () => {
    for (const { task, scored: s } of scored) {
      expect([task.name, s?.result.level ?? null]).toEqual([task.name, task.expected_level]);
    }
    const levels = scored.flatMap(({ scored: s }) => (s ? [s.result.level] : []));
    expect(new Set(levels)).toEqual(new Set(["low", "caution", "high", "very-high"]));
  });

  it("gives every option a positive reduction on its own workstation", () => {
    for (const option of demo.options) {
      const workstation = demo.workstations.find((w) => w.code === option.code);
      const tasks = scored.filter(({ task }) => task.code === option.code);
      expect(workstation, option.title).toBeDefined();
      const input: OptimizerWorkstation = {
        id: option.code,
        headcount: workstation?.headcount ?? 0,
        level: null,
        tasks: tasks.map(({ task, scored: s }) => ({
          id: task.name,
          dailyHours: task.daily_hours,
          highRiskRatio: s?.result.highRiskRatio ?? null,
        })),
        options: [],
      };
      const reduction = optionReduction(input, {
        id: option.title,
        cost: option.cost,
        effects: option.effects.map((e) => ({
          taskId: e.task,
          expectedHighRiskRatio: e.expected_high_risk_ratio,
          source: "manual",
        })),
      });
      expect(reduction, option.title).toBeGreaterThan(0);
    }
  });

  it("matches the generated parts of the SQL files", () => {
    expect(generatedSection("demo-data.sql", "structure", structureSql())).toBe(
      `${structureSql()}\n`,
    );
    for (const [file, name] of [
      ["demo-data.sql", "site name"],
      ["demo-cleanup.sql", "site name"],
      ["verify.sql", "site name"],
      ["verify.sql", "site name for block 15"],
    ]) {
      expect(generatedSection(file, name, siteNameSql), `${file}: ${name}`).toBe(
        `${siteNameSql}\n`,
      );
    }
  });
});
