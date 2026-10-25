import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, type Landmark, type PoseFrame } from "./landmarks";
import { optimizePlan, optionReduction, type OptimizerWorkstation } from "./optimizer";
import { assessSession } from "./reba-session";
import type { RiskLevel, TaskInputs } from "./reba-score";

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
type Segment = { posture: string | null; seconds: number };
type ExpectedPlan = { budget: number; total_cost: number; total_reduction: number };
type ExtraFixture = {
  partners: string[];
  existing_partner: string;
  simulations: { option: string; task: string; days_ago: number; segments: Segment[] }[];
  requests: {
    option: string;
    status: "draft" | "open" | "closed";
    title: string;
    description: string | null;
    desired_in_days: number | null;
    created_days_ago: number;
    opened_days_ago: number | null;
    closed_days_ago: number | null;
    quotes: {
      partner: string;
      price: number;
      lead_time_days: number;
      note: string | null;
      submitted_days_ago: number;
      accepted?: boolean;
    }[];
  }[];
  expected_plans: ExpectedPlan[];
  presentation_accept: { option: string; partner: string; expected_plan: ExpectedPlan };
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
const extra = JSON.parse(readFileSync(fixtureUrl("demo_extra_v1.json"), "utf8")) as ExtraFixture;
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
function score(task: DemoFixture["tasks"][number], segments: Segment[]) {
  const frames: PoseFrame[] = [];
  for (const segment of segments) {
    const points = landmarks(segment.posture);
    for (let i = 0; i < segment.seconds * demo.fps; i++) {
      frames.push({ t: frames.length / demo.fps, landmarks: points });
    }
  }
  const result = assessSession({ width: SIZE, height: SIZE, frames }, toInputs(task.inputs));
  if (!result.ok) {
    throw new Error(`${task.code} ${task.name}: ${result.reason}`);
  }
  return { frameCount: frames.length, result };
}

function session(task: DemoFixture["tasks"][number]) {
  if (task.session === null) {
    return null;
  }
  return { ...score(task, task.session.segments), daysAgo: task.session.days_ago };
}

const scored = demo.tasks.map((task) => ({ task, scored: session(task) }));

const taskNamed = (name: string) => {
  const task = demo.tasks.find((t) => t.name === name);
  if (!task) {
    throw new Error(`no task named ${name}`);
  }
  return task;
};
const optionTitled = (title: string) => {
  const option = demo.options.find((o) => o.title === title);
  if (!option) {
    throw new Error(`no option titled ${title}`);
  }
  return option;
};

/** Simulation captures scored like assessments, with the task's own manager inputs. */
const simulated = extra.simulations.map((sim) => ({
  sim,
  task: taskNamed(sim.task),
  option: optionTitled(sim.option),
  ...score(taskNamed(sim.task), sim.segments),
}));

const LEVEL_ORDER: RiskLevel[] = ["low", "caution", "high", "very-high"];

/** The demo site as the optimizer sees it: simulations replace manual effects, quotes set costs. */
function optimizerInput(costs: Record<string, number>): OptimizerWorkstation[] {
  return demo.workstations.map((w) => {
    const tasks = scored.filter(({ task }) => task.code === w.code);
    const levels = tasks.flatMap(({ scored: s }) => (s ? [s.result.level] : []));
    return {
      id: w.code,
      headcount: w.headcount,
      level: levels.length
        ? levels.reduce((a, b) => (LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b))
        : null,
      tasks: tasks.map(({ task, scored: s }) => ({
        id: task.name,
        dailyHours: task.daily_hours,
        highRiskRatio: s?.result.highRiskRatio ?? null,
      })),
      options: demo.options
        .filter((o) => o.code === w.code)
        .map((o) => ({
          id: o.title,
          cost: costs[o.title] ?? o.cost,
          effects: o.effects.map((e) => {
            const sim = simulated.find((x) => x.option === o && x.task.name === e.task);
            return sim
              ? {
                  taskId: e.task,
                  expectedHighRiskRatio: sim.result.highRiskRatio,
                  source: "simulation" as const,
                }
              : {
                  taskId: e.task,
                  expectedHighRiskRatio: e.expected_high_risk_ratio,
                  source: "manual" as const,
                };
          }),
        })),
    };
  });
}

/** Option costs after the accepted quotes in the fixture. */
const acceptedCosts = Object.fromEntries(
  extra.requests.flatMap((r) => r.quotes.filter((q) => q.accepted).map((q) => [r.option, q.price])),
);

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

const int = (value: number | null) => (value === null ? "null::integer" : String(value));

function simulationsSql(): string {
  return `-- Simulation captures as save_simulation_capture would store them, then each becomes its
-- option's effect for the task, replacing the manual value.
insert into public.simulation_captures (
  option_id, task_id, frame_count, inference_fps, task_inputs, part_summary,
  valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version, created_at
)
select o.id, t.id, v.frame_count, v.inference_fps, v.task_inputs::jsonb, v.part_summary::jsonb,
  v.valid_frame_ratio, v.high_risk_ratio, v.score_p90, v.level, v.algorithm_version,
  now() - make_interval(days => v.days_ago)
from (values
${rows(
  simulated.map(({ sim, task, option, frameCount, result }) => [
    text(option.code),
    text(option.title),
    text(task.name),
    String(frameCount),
    String(demo.fps),
    text(JSON.stringify(task.inputs)),
    text(JSON.stringify(result.partSummary)),
    String(result.validFrameRatio),
    String(result.highRiskRatio),
    String(result.scoreP90),
    text(result.level),
    text(result.algorithmVersion),
    String(sim.days_ago),
  ]),
)}
) as v (
  code, option, task, frame_count, inference_fps, task_inputs, part_summary,
  valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version, days_ago
)
${SITE_JOIN}
${WORKSTATION_JOIN}
join public.improvement_options o on o.workstation_id = w.id and o.title = v.option
join public.tasks t on t.workstation_id = w.id and t.name = v.task;

insert into public.option_effects as e (
  option_id, task_id, expected_high_risk_ratio, source, capture_id
)
select c.option_id, c.task_id, c.high_risk_ratio, 'simulation', c.id
from public.simulation_captures c
join public.tasks t on t.id = c.task_id
join public.workstations w on w.id = t.workstation_id
join public.sites s on s.id = w.site_id and s.name = current_setting('demo.site_name')
on conflict (option_id, task_id) do update
set expected_high_risk_ratio = excluded.expected_high_risk_ratio,
  source = 'simulation',
  capture_id = excluded.capture_id;`;
}

function requestsSql(): string {
  return `-- Requests in every status. The demo site's first manager is recorded as their author.
insert into public.improvement_requests (
  workstation_id, option_id, title, description, desired_by, status, created_by,
  created_at, opened_at, closed_at
)
select w.id, o.id, v.title, v.description,
  (now() at time zone 'Asia/Seoul')::date + v.desired_in_days,
  v.status, m.profile_id,
  now() - make_interval(days => v.created_days_ago),
  now() - make_interval(days => v.opened_days_ago),
  now() - make_interval(days => v.closed_days_ago)
from (values
${rows(
  extra.requests.map((r) => [
    text(optionTitled(r.option).code),
    text(r.option),
    text(r.status),
    text(r.title),
    r.description === null ? "null::text" : text(r.description),
    int(r.desired_in_days),
    String(r.created_days_ago),
    int(r.opened_days_ago),
    int(r.closed_days_ago),
  ]),
)}
) as v (
  code, option, status, title, description, desired_in_days, created_days_ago,
  opened_days_ago, closed_days_ago
)
${SITE_JOIN}
${WORKSTATION_JOIN}
join public.improvement_options o on o.workstation_id = w.id and o.title = v.option
cross join lateral (
  select sm.profile_id
  from public.site_members sm
  join public.profiles p on p.id = sm.profile_id
  where sm.site_id = s.id and p.role = 'manager'
  order by sm.profile_id
  limit 1
) as m;

-- Quotes. No company changed its quote after submitting it, so updated_at is the submission
-- time; accepting or closing does not move it (migration 20261031000001).
insert into public.quotes (
  request_id, partner_id, price, lead_time_days, note, status, created_at, updated_at
)
select r.id, p.id, v.price, v.lead_time_days, v.note,
  case when r.status = 'open' then 'submitted' when v.accepted then 'accepted' else 'rejected' end,
  now() - make_interval(days => v.submitted_days_ago),
  now() - make_interval(days => v.submitted_days_ago)
from (values
${rows(
  extra.requests.flatMap((r) =>
    r.quotes.map((q) => [
      text(optionTitled(r.option).code),
      text(r.option),
      text(q.partner),
      String(q.price),
      String(q.lead_time_days),
      q.note === null ? "null::text" : text(q.note),
      String(q.accepted === true),
      String(q.submitted_days_ago),
    ]),
  ),
)}
) as v (code, option, partner, price, lead_time_days, note, accepted, submitted_days_ago)
${SITE_JOIN}
${WORKSTATION_JOIN}
join public.improvement_options o on o.workstation_id = w.id and o.title = v.option
join public.improvement_requests r on r.option_id = o.id
join public.partners p on p.company_name = v.partner;`;
}

const partnerNamesSql = `select set_config('demo.partners', ${text(JSON.stringify(extra.partners))}, true);`;

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

  it("scores every simulation below the task's current ratio, on the option's workstation", () => {
    for (const { sim, task, option, result } of simulated) {
      const current = scored.find((x) => x.task === task)?.scored?.result.highRiskRatio;
      expect([sim.option, option.code]).toEqual([sim.option, task.code]);
      expect(
        option.effects.some((e) => e.task === task.name),
        sim.option,
      ).toBe(true);
      expect(current, sim.task).toBeDefined();
      expect(result.highRiskRatio, sim.task).toBeLessThan(current ?? 0);
    }
  });

  it("has requests in every status, with one accepted quote where a request was accepted", () => {
    const companies = [...extra.partners, extra.existing_partner];
    expect(new Set(extra.requests.map((r) => r.status))).toEqual(
      new Set(["draft", "open", "closed"]),
    );
    for (const r of extra.requests) {
      optionTitled(r.option);
      expect(
        r.quotes.every((q) => companies.includes(q.partner)),
        r.option,
      ).toBe(true);
      expect(new Set(r.quotes.map((q) => q.partner)).size, r.option).toBe(r.quotes.length);
      const accepted = r.quotes.filter((q) => q.accepted).length;
      expect(accepted, r.option).toBe(r.status === "closed" ? accepted : 0);
      expect(accepted, r.option).toBeLessThanOrEqual(1);
      expect(r.quotes.length > 0, r.option).toBe(r.status !== "draft");
    }
    expect(extra.requests.filter((r) => r.quotes.some((q) => q.accepted))).toHaveLength(1);
    expect(
      extra.requests.some((r) => r.status === "closed" && !r.quotes.some((q) => q.accepted)),
    ).toBe(true);
  });

  it("gives the plans that docs/deployment.md lists, before and after the presentation", () => {
    const plan = (budget: number, costs: Record<string, number>) => {
      const result = optimizePlan({ budget, workstations: optimizerInput(costs) });
      return {
        budget,
        total_cost: result.totalCost,
        total_reduction: Math.round(result.totalReduction * 100) / 100,
      };
    };
    for (const expected of extra.expected_plans) {
      expect(plan(expected.budget, acceptedCosts)).toEqual(expected);
    }
    const accept = extra.presentation_accept;
    const quote = extra.requests
      .find((r) => r.option === accept.option && r.status === "open")
      ?.quotes.find((q) => q.partner === accept.partner);
    expect(quote).toBeDefined();
    expect(
      plan(accept.expected_plan.budget, { ...acceptedCosts, [accept.option]: quote?.price ?? 0 }),
    ).toEqual(accept.expected_plan);
  });

  it("matches the generated parts of the SQL files", () => {
    expect(generatedSection("demo-data.sql", "structure", structureSql())).toBe(
      `${structureSql()}\n`,
    );
    expect(generatedSection("demo-data.sql", "simulations", simulationsSql())).toBe(
      `${simulationsSql()}\n`,
    );
    expect(generatedSection("demo-data.sql", "requests", requestsSql())).toBe(`${requestsSql()}\n`);
    for (const [file, name] of [
      ["demo-data.sql", "partner names"],
      ["demo-cleanup.sql", "partner names"],
      ["verify.sql", "partner names for block 18"],
    ]) {
      expect(generatedSection(file, name, partnerNamesSql), `${file}: ${name}`).toBe(
        `${partnerNamesSql}\n`,
      );
    }
    for (const [file, name] of [
      ["demo-data.sql", "site name"],
      ["demo-cleanup.sql", "site name"],
      ["verify.sql", "site name"],
      ["verify.sql", "site name for block 15"],
      ["verify.sql", "site name for block 16"],
      ["verify.sql", "site name for block 17"],
      ["verify.sql", "site name for block 18"],
      ["verify.sql", "site name for block 19"],
    ]) {
      expect(generatedSection(file, name, siteNameSql), `${file}: ${name}`).toBe(
        `${siteNameSql}\n`,
      );
    }
  });
});
