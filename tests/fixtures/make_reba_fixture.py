"""Generates tests/fixtures/reba_postures_v1.json from hand-placed synthetic postures.

Run from the repository root (Python standard library only):
    python3 -I tests/fixtures/make_reba_fixture.py tests/fixtures/reba_postures_v1.json

Postures are side views in pixels with image y pointing down. Left and right landmarks share
coordinates unless noted. Each pixel point is written as a MediaPipe image fraction [x / width,
y / height]. Expected scores are computed by hand from docs/assessment-rules.md (reba-2d-v1)
with activity 0; the TypeScript tests check the code against them.

The fixture contains no AI Hub data and nothing taken from real video.
Changing an existing case's expected values requires a new fixture version (deullim-assessment skill).
"""

import json
import sys

TASK = {
    "load_category": "lt5",
    "load_shock": False,
    "coupling": "good",
    "static_hold": False,
    "unstable_base": False,
    "sitting": False,
    "arm_supported": False,
}


def body(sh, hip, nose, ear, elbow, wrist, hand, knee, ankle, r_knee=None, r_ankle=None, foot=None):
    """MediaPipe landmark index -> pixel point. foot is (heel, foot index) for both feet."""
    points = {
        0: nose, 7: ear, 8: ear, 11: sh, 12: sh, 13: elbow, 14: elbow, 15: wrist, 16: wrist,
        17: hand, 18: hand, 19: hand, 20: hand, 23: hip, 24: hip, 25: knee, 26: r_knee or knee,
        27: ankle, 28: r_ankle or ankle,
    }
    if foot is not None:
        heel, toe = foot
        points.update({29: heel, 30: heel, 31: toe, 32: toe})
    return points


def expected(trunk, neck, legs, upper_arm, lower_arm, wrist, table_a, score_a, table_b, score_b,
             table_c, level):
    return {
        "trunk": trunk, "neck": neck, "legs": legs, "upper_arm": upper_arm,
        "lower_arm": lower_arm, "wrist": wrist, "table_a": table_a, "score_a": score_a,
        "table_b": table_b, "score_b": score_b, "table_c": table_c, "final": table_c,
        "level": level,
    }


cases = []


def add(name, note, points, expect, task=None, size=(1000, 1000)):
    width, height = size
    cases.append({
        "name": name,
        "note": note,
        "width": width,
        "height": height,
        "task": {**TASK, **(task or {})},
        "landmarks": {
            str(index): [round(x / width, 6), round(y / height, 6)]
            for index, (x, y) in sorted(points.items())
        },
        "expected": expect,
    })


HEAVY = {"load_category": "gt10", "coupling": "poor"}

upright = body(sh=(500, 300), hip=(500, 600), nose=(540, 230), ear=(505, 235), elbow=(505, 450),
               wrist=(655, 450), hand=(715, 452), knee=(500, 750), ankle=(500, 900))
add("standing upright",
    "trunk 0, neck ~4 flexion, upper arm ~2, elbow ~88, wrist ~1, knees straight",
    upright, expected(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, "low"))

bent = body(sh=(790, 522), hip=(500, 600), nose=(880, 560), ear=(850, 540), elbow=(790, 672),
            wrist=(790, 822), hand=(790, 882), knee=(500, 750), ankle=(500, 900))
add("deep trunk flexion with heavy load",
    "trunk ~75 flexion, arms hanging (~75 to the trunk), load > 10 kg, poor coupling",
    bent, expected(4, 2, 1, 3, 2, 1, 5, 7, 4, 6, 9, "high"), HEAVY)
add("deep trunk flexion, 1920x1080 frame",
    "same pixels as above; fractions differ per axis, so the aspect must be restored",
    bent, expected(4, 2, 1, 3, 2, 1, 5, 7, 4, 6, 9, "high"), HEAVY, size=(1920, 1080))

raised = body(sh=(500, 300), hip=(500, 600), nose=(540, 230), ear=(505, 235), elbow=(606, 194),
              wrist=(712, 88), hand=(712, 28), knee=(500, 750), ankle=(500, 900))
add("arms raised above the shoulder",
    "upper arm 135 forward, elbow straight, wrist bent ~45",
    raised, expected(1, 1, 1, 4, 2, 2, 1, 1, 6, 6, 3, "low"))

squat = body(sh=(500, 400), hip=(500, 700), nose=(540, 330), ear=(505, 335), elbow=(505, 550),
             wrist=(655, 550), hand=(715, 552), knee=(650, 760), ankle=(560, 900))
add("deep squat", "knee flexion ~101",
    squat, expected(1, 1, 3, 1, 1, 1, 3, 3, 1, 1, 2, "low"))
add("deep squat, seated task", "sitting: no knee adjustment",
    squat, expected(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, "low"), {"sitting": True})

one_leg = body(sh=(500, 300), hip=(500, 600), nose=(540, 230), ear=(505, 235), elbow=(505, 450),
               wrist=(655, 450), hand=(715, 452), knee=(500, 750), ankle=(500, 900),
               r_knee=(570, 700), r_ankle=(530, 740))
add("standing on one leg", "right ankle 160 px (0.53 trunk) above the left; right knee ~80",
    one_leg, expected(1, 1, 4, 1, 1, 1, 4, 4, 1, 1, 3, "low"))

lean = body(sh=(626.8, 328.1), hip=(500, 600), nose=(700, 300), ear=(670, 280),
            elbow=(626.8, 478.1), wrist=(776.8, 478.1), hand=(836.8, 480), knee=(500, 750),
            ankle=(394, 856))
add("moderate trunk flexion, 1920x1080 frame",
    "trunk 25 and knees 45 cross band edges only when the aspect is restored (unrestored: ~15 and ~29)",
    lean, expected(3, 1, 2, 2, 1, 1, 4, 4, 1, 1, 3, "low"), size=(1920, 1080))

look_up = body(sh=(790, 522), hip=(500, 600), nose=(880, 430), ear=(840, 470), elbow=(790, 672),
               wrist=(790, 822), hand=(790, 882), knee=(500, 750), ankle=(500, 900),
               foot=((490, 900), (560, 905)))
add("deep trunk flexion, looking up",
    "trunk ~75 flexion with the head raised above the trunk line (nose alone would say facing left); "
    "feet point right, so facing comes from the feet; neck ~31 extension",
    look_up, expected(4, 2, 1, 3, 2, 1, 5, 5, 4, 4, 5, "caution"))

fixture = {
    "version": 1,
    "description": (
        "Synthetic side-view postures (hand-placed, no real data), generated by "
        "tests/fixtures/make_reba_fixture.py. Landmarks are MediaPipe image fractions [x, y] keyed "
        "by landmark index with visibility 1; missing indices are invisible. Expected REBA part "
        "scores and table scores follow docs/assessment-rules.md (reba-2d-v1) with activity 0."
    ),
    "cases": cases,
}

with open(sys.argv[1], "w", encoding="utf-8") as out:
    json.dump(fixture, out, ensure_ascii=False, indent=2)
    out.write("\n")
