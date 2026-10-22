"""Aggregate joint angles per AI Hub posture code (dataSetSn 71439, Validation VL.zip).

Reads the zip in place and prints only aggregates (counts, ratios, quantiles).
Never prints individual records, coordinates, or file names.
"""
import argparse
import glob
import json
import math
import os
import re
import statistics
import sys
import zipfile
from collections import Counter, defaultdict

import angles as ang

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ZIP_GLOB = os.path.join(REPO, "data/aihub/253.*/01-1.*/Validation/02.*/VL.zip")
RESULT_PATH = os.path.join(HERE, "results", "posture_code_angles_v1.md")
DIAGNOSTICS_PATH = os.path.join(HERE, "results", "keypoint_diagnostics_v1.md")
# Groups with fewer valid values than this show "-" so no single record leaks.
MIN_N = 10

IMAGE_KEYS = ["id", "file_name", "width", "height", "date_captured", "light", "angle"]
POSTURE_ITEMS = ["neck", "trunk", "upperarm", "lowerarm", "legs"]
EXTRA_FLAGS = [
    "neck_twist", "neck_bending", "trunk_twist", "trunk_bending", "trunk_supported",
    "legs_supported", "upperarm_abduction", "upperarm_raised", "upperarm_supported",
    "upperarm_across", "lowerarm_outbody", "wrist_bending", "wrist_twisted", "wrist_twisted_end",
]
ANNOTATION_KEYS = ["id", "image_id", "factory", "process", "worker", "bbox", "keypoints", "posture"] + EXTRA_FLAGS

ITEM_METRICS = {
    "neck": ["neck_angle"],
    "trunk": ["trunk_angle"],
    "upperarm": ["upperarm_l", "upperarm_r", "upperarm_max"],
    "lowerarm": ["elbow_l", "elbow_r", "elbow_max"],
    "legs": ["knee_l", "knee_r", "knee_max", "ankle_height_diff"],
}
ITEM_KEYPOINTS = {
    "neck": [0, 4, 18],
    "trunk": [4, 18],
    "upperarm": [4, 18, 5, 6, 11, 12],
    "lowerarm": [5, 6, 7, 11, 12, 13],
    "legs": [19, 20, 21, 23, 24, 25],
}
# Wrist flags have no matching angle in this analysis.
FLAG_METRIC = {
    "neck_twist": "neck_angle", "neck_bending": "neck_angle",
    "trunk_twist": "trunk_angle", "trunk_bending": "trunk_angle", "trunk_supported": "trunk_angle",
    "legs_supported": "knee_max",
    "upperarm_abduction": "upperarm_max", "upperarm_raised": "upperarm_max",
    "upperarm_supported": "upperarm_max", "upperarm_across": "upperarm_max",
    "lowerarm_outbody": "elbow_max",
}

out_lines = []


def emit(line=""):
    print(line)
    out_lines.append(line)


def table(headers, rows):
    emit("| " + " | ".join(headers) + " |")
    emit("|" + "---|" * len(headers))
    for r in rows:
        emit("| " + " | ".join(fmt(v) for v in r) + " |")
    emit()


def fmt(v):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:.2f}"
    return str(v)


def pct(n, d):
    return f"{100 * n / d:.1f}%" if d else "-"


def summary(values):
    vals = [v for v in values if v is not None]
    if len(vals) < MIN_N:
        return [len(vals), None, None, None, None]
    q = statistics.quantiles(vals, n=4, method="inclusive")
    return [len(vals), statistics.fmean(vals), q[0], q[1], q[2]]


def quantile_row(values, cuts=(0.05, 0.25, 0.5, 0.75, 0.95)):
    vals = sorted(v for v in values if v is not None)
    if len(vals) < MIN_N:
        return [len(vals)] + [None] * len(cuts)
    return [len(vals)] + [vals[min(len(vals) - 1, int(c * (len(vals) - 1) + 0.5))] for c in cuts]


def find_zip():
    hits = glob.glob(ZIP_GLOB)
    if len(hits) != 1:
        sys.exit(f"Expected exactly one VL.zip, found {len(hits)}")
    return hits[0]


def iter_json(zip_path, stats):
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if info.is_dir() or not info.filename.lower().endswith(".json"):
                continue
            stats["json_files"] += 1
            try:
                yield json.loads(zf.read(info).decode("utf-8-sig"))
            except (ValueError, UnicodeDecodeError):
                stats["json_parse_errors"] += 1


# ---------- schema mode ----------

SAFE_KEY = re.compile(r"[A-Za-z_][A-Za-z0-9_]*$")


def walk(node, path, counter):
    counter[(path, type(node).__name__)] += 1
    if isinstance(node, dict):
        for k, v in node.items():
            # Keys that are not identifiers might be data (e.g. file names), so mask them.
            name = k if SAFE_KEY.match(k) else "<key>"
            walk(v, f"{path}.{name}" if path else name, counter)
    elif isinstance(node, list):
        for v in node:
            walk(v, path + "[]", counter)


def run_schema(zip_path):
    stats = Counter()
    paths = Counter()
    missing_image = Counter()
    missing_ann = Counter()
    missing_posture = Counter()
    kp_shapes = Counter()
    bbox_lens = Counter()
    multi_ann_images = 0
    for data in iter_json(zip_path, stats):
        walk(data, "", paths)
        images = data.get("images") if isinstance(data, dict) else None
        anns = data.get("annotations") if isinstance(data, dict) else None
        if not isinstance(images, list) or not isinstance(anns, list):
            stats["files_without_images_or_annotations"] += 1
            continue
        stats["images"] += len(images)
        stats["annotations"] += len(anns)
        for img in images:
            for k in IMAGE_KEYS:
                missing_image[k] += k not in img
        per_image = Counter(a.get("image_id") for a in anns)
        multi_ann_images += sum(1 for c in per_image.values() if c >= 2)
        for a in anns:
            for k in ANNOTATION_KEYS:
                missing_ann[k] += k not in a
            posture = a.get("posture")
            for k in POSTURE_ITEMS:
                missing_posture[k] += not isinstance(posture, dict) or k not in posture
            kp_shapes[keypoint_shape(a.get("keypoints"))] += 1
            bbox = a.get("bbox")
            bbox_lens[len(bbox) if isinstance(bbox, list) else type(bbox).__name__] += 1

    emit("# AI Hub label schema check (4-0)")
    emit()
    table(["metric", "count"], sorted(stats.items()) + [("images_with_2plus_annotations", multi_ann_images)])
    emit("## Key paths")
    table(["path", "type", "count"], [(p, t, c) for (p, t), c in sorted(paths.items())])
    emit("## Missing expected keys")
    rows = [("images[]." + k, v) for k, v in missing_image.items()]
    rows += [("annotations[]." + k, v) for k, v in missing_ann.items()]
    rows += [("annotations[].posture." + k, v) for k, v in missing_posture.items()]
    table(["key", "missing"], rows)
    emit("## keypoints shape")
    table(["shape", "count"], sorted(kp_shapes.items(), key=str))
    emit("## bbox length")
    table(["length", "count"], sorted(bbox_lens.items(), key=str))


def keypoint_shape(kp):
    if not isinstance(kp, list):
        return type(kp).__name__
    if kp and all(isinstance(p, list) for p in kp):
        return f"{len(kp)}x{'/'.join(sorted({str(len(p)) for p in kp}))}"
    return f"flat {len(kp)}"


# ---------- analysis mode ----------

def parse_keypoints(kp):
    """Return 27 (x, y, flag) tuples from nested 27x3 or flat 81 lists, else None."""
    if not isinstance(kp, list):
        return None
    if len(kp) == 27 and all(isinstance(p, list) and len(p) >= 3 for p in kp):
        return [(float(p[0]), float(p[1]), p[2]) for p in kp]
    if len(kp) == 81:
        return [(float(kp[i]), float(kp[i + 1]), kp[i + 2]) for i in range(0, 81, 3)]
    return None


def bbox_box(bbox, mode):
    x, y, a, b = (float(v) for v in bbox)
    return (x, y, x + a, y + b) if mode == "xywh" else (x, y, a, b)


def compute_angles(p):
    m = {
        "trunk_angle": ang.trunk_angle(p[18], p[4]),
        "neck_angle": ang.neck_angle(p[18], p[4], p[0]),
        "upperarm_l": ang.upperarm_angle(p[4], p[18], p[5], p[6]),
        "upperarm_r": ang.upperarm_angle(p[4], p[18], p[11], p[12]),
        "elbow_l": ang.elbow_flexion(p[5], p[6], p[7]),
        "elbow_r": ang.elbow_flexion(p[11], p[12], p[13]),
        "knee_l": ang.knee_flexion(p[19], p[20], p[21]),
        "knee_r": ang.knee_flexion(p[23], p[24], p[25]),
        "ankle_height_diff": ang.ankle_height_diff(p[21], p[25], p[5], p[11]),
    }
    for name in ("upperarm", "elbow", "knee"):
        m[name + "_max"] = ang.max_or_none(m[name + "_l"], m[name + "_r"])
    return m


def load_records(zip_path, stats):
    records = []
    image_values = {"light": Counter(), "angle": Counter()}
    for data in iter_json(zip_path, stats):
        if not isinstance(data, dict):
            continue
        images = {img.get("id"): img for img in data.get("images") or []}
        for img in images.values():
            for k in image_values:
                image_values[k][str(img.get(k))] += 1
        for a in data.get("annotations") or []:
            stats["annotations"] += 1
            img = images.get(a.get("image_id"))
            kp = parse_keypoints(a.get("keypoints"))
            bbox = a.get("bbox")
            if img is None or kp is None or not (isinstance(bbox, list) and len(bbox) == 4):
                stats["skipped_malformed"] += 1
                continue
            records.append({
                "w": float(img["width"]), "h": float(img["height"]),
                "light": str(img.get("light")), "camera": str(img.get("angle")),
                "bbox": bbox, "kp": kp,
                "posture": a.get("posture") or {},
                "flags": {f: a.get(f) for f in EXTRA_FLAGS},
            })
    return records, image_values


def bbox_check(records, mode):
    inside_all = out_of_image = invalid = 0
    inside_ratio = []
    for r in records:
        x1, y1, x2, y2 = bbox_box(r["bbox"], mode)
        if x2 <= x1 or y2 <= y1:
            invalid += 1
        if x1 < 0 or y1 < 0 or x2 > r["w"] or y2 > r["h"]:
            out_of_image += 1
        n_in = sum(1 for x, y, _ in r["kp"] if x1 <= x <= x2 and y1 <= y <= y2)
        inside_ratio.append(n_in / 27)
        inside_all += n_in == 27
    return {
        "mean_kp_inside": statistics.fmean(inside_ratio) if inside_ratio else 0.0,
        "all_kp_inside": inside_all,
        "out_of_image": out_of_image,
        "invalid": invalid,
    }


def order_check(records, label):
    n = len(records)
    below = Counter()
    head_ratio = []
    elbow_ok = Counter()
    for r in records:
        p = r["kp"]
        pelvis_low = max(p[i][1] for i in (18, 19, 23))
        for i in (21, 25, 22, 26):
            below[i] += p[i][1] > pelvis_low
        below["all"] += all(p[i][1] > pelvis_low for i in (21, 25, 22, 26))
        sw = math.dist(p[5][:2], p[11][:2])
        if sw > 0:
            head_ratio.append(max(math.dist(p[i][:2], p[j][:2]) for i in range(4) for j in range(i + 1, 4)) / sw)
        for side, (s, e, w) in (("left", (5, 6, 7)), ("right", (11, 12, 13))):
            elbow_ok[side] += elbow_within(p[s], p[e], p[w])
    emit(f"### {label} (n={n})")
    table(["check", "count", "ratio"],
          [(f"kp {i} below pelvis (18,19,23)", below[i], pct(below[i], n)) for i in (21, 25, 22, 26)]
          + [("all of 21,25,22,26 below pelvis", below["all"], pct(below["all"], n))]
          + [(f"{s} elbow within shoulder-wrist distance", elbow_ok[s], pct(elbow_ok[s], n)) for s in ("left", "right")])
    table(["ratio", "n", "p5", "p25", "p50", "p75", "p95"],
          [["max dist among kp 0-3 / shoulder width"] + quantile_row(head_ratio)])


def keypoint_diagnostics(records, bbox_mode):
    n = len(records)
    nonpos, off_image, off_bbox = Counter(), Counter(), Counter()
    invalid_counts, invalid_sets = Counter(), Counter()
    lower_all = upper_all = 0
    for r in records:
        x1, y1, x2, y2 = bbox_box(r["bbox"], bbox_mode)
        bad = set()
        for i, (x, y, _) in enumerate(r["kp"]):
            checks = (
                x <= 0 or y <= 0,
                not (0 <= x <= r["w"] and 0 <= y <= r["h"]),
                not (x1 <= x <= x2 and y1 <= y <= y2),
            )
            nonpos[i] += checks[0]
            off_image[i] += checks[1]
            off_bbox[i] += checks[2]
            if any(checks):
                bad.add(i)
        invalid_counts[len(bad)] += 1
        invalid_sets[tuple(sorted(bad))] += 1
        lower_all += bad >= set(range(20, 27))
        upper_all += bad >= set(range(17))
    emit(f"Invalid = x or y <= 0, or outside image, or outside bbox ({bbox_mode}). n={n}")
    emit()
    table(["kp", "x or y <= 0", "outside image", "outside bbox"],
          [(i, pct(nonpos[i], n), pct(off_image[i], n), pct(off_bbox[i], n)) for i in range(27)])
    table(["invalid kp count", "records", "ratio"], [(k, c, pct(c, n)) for k, c in sorted(invalid_counts.items())])
    table(["pattern", "records", "ratio"],
          [("kp 20-26 all invalid", lower_all, pct(lower_all, n)), ("kp 0-16 all invalid", upper_all, pct(upper_all, n))])
    emit("Top 10 invalid keypoint sets")
    emit()
    table(["invalid kp set", "records", "ratio"],
          [(",".join(map(str, s)) or "(none)", c, pct(c, n)) for s, c in invalid_sets.most_common(10)])


def elbow_within(shoulder, elbow, wrist):
    # Elbow counts as "within" when both segments are no longer than shoulder-to-wrist.
    reach = math.dist(shoulder[:2], wrist[:2])
    return math.dist(shoulder[:2], elbow[:2]) <= reach and math.dist(elbow[:2], wrist[:2]) <= reach


def code_tables(records, group_key=None, group_label=None):
    for item in POSTURE_ITEMS:
        groups = defaultdict(list)
        for r in records:
            g = group_key(r, item) if group_key else None
            groups[(g, str(r["posture"].get(item, "<missing>")))].append(r)
        rows = []
        for (g, code), rs in sorted(groups.items(), key=lambda kv: (str(kv[0][0]), kv[0][1])):
            for metric in ITEM_METRICS[item]:
                prefix = [g] if group_key else []
                rows.append(prefix + [code, len(rs), metric] + summary(r["m"][metric] for r in rs))
        emit(f"### {item}")
        headers = ([group_label] if group_key else []) + ["code", "n", "metric", "n_valid", "mean", "p25", "p50", "p75"]
        table(headers, rows)


def run_analysis(zip_path, margin, bbox_mode, diagnose_only):
    stats = Counter()
    records, image_values = load_records(zip_path, stats)
    emit("# AI Hub posture code vs joint angle aggregates (v1)")
    emit()
    table(["metric", "count"], sorted(stats.items()) + [("records", len(records))])

    emit("## 4-2 bbox format")
    checks = {mode: bbox_check(records, mode) for mode in ("xywh", "xyxy")}
    n = len(records)
    table(["interpretation", "mean kp inside", "records all 27 kp inside", "bbox outside image", "invalid (x2<=x1 or y2<=y1)"],
          [(mode, f"{100 * c['mean_kp_inside']:.1f}%", pct(c["all_kp_inside"], n), pct(c["out_of_image"], n), pct(c["invalid"], n))
           for mode, c in checks.items()])
    if bbox_mode == "auto":
        # The xywh box always contains the xyxy box for positive coordinates,
        # so kp-inside ratio is biased toward xywh and is only a tie-breaker.
        bbox_mode = min(checks, key=lambda m: (checks[m]["invalid"] + checks[m]["out_of_image"], -checks[m]["mean_kp_inside"]))
        emit(f"Chosen bbox interpretation: {bbox_mode} (auto: fewer invalid or outside-image bboxes, then higher mean kp inside)")
    else:
        emit(f"Chosen bbox interpretation: {bbox_mode} (set by --bbox)")
    emit()

    def full_body(r):
        _, y1, _, y2 = bbox_box(r["bbox"], bbox_mode)
        return y1 >= margin and y2 <= r["h"] - margin

    filtered = [r for r in records if full_body(r)]

    emit("## 4-1 keypoint order")
    order_check(records, "all records")
    order_check(filtered, "full-body filtered records")

    emit("## 4-3 keypoint validity (all records)")
    keypoint_diagnostics(records, bbox_mode)

    emit(f"## 5 filter (margin={margin}px, bbox={bbox_mode})")
    table(["stage", "records"], [("before filter", n), ("after filter", len(filtered))])
    if diagnose_only:
        return

    for r in filtered:
        r["m"] = compute_angles([(x, y) for x, y, _ in r["kp"]])

    emit("## 7-1 angles by posture code")
    code_tables(filtered)
    emit("## 7-2 angles by posture code and camera angle (images[].angle)")
    code_tables(filtered, lambda r, item: r["camera"], "camera angle")
    emit("## 7-3 angles by posture code and number of target keypoints with flag=2")
    for item, idx in ITEM_KEYPOINTS.items():
        emit(f"Target keypoints for {item}: {', '.join(map(str, idx))}")
    emit()
    code_tables(filtered, lambda r, item: sum(r["kp"][i][2] == 2 for i in ITEM_KEYPOINTS[item]), "flag=2 count")

    emit("## 7-4 extra flags")
    rows = []
    for f in EXTRA_FLAGS:
        values = Counter(str(r["flags"][f]) for r in filtered)
        metric = FLAG_METRIC.get(f)
        medians = []
        for v in sorted(values):
            vals = [r["m"][metric] for r in filtered if str(r["flags"][f]) == v and r["m"][metric] is not None] if metric else []
            medians.append(f"{v}: {statistics.median(vals):.2f}" if len(vals) >= MIN_N else f"{v}: -")
        rows.append((f, ", ".join(f"{v}={c}" for v, c in sorted(values.items())), metric or "-", "; ".join(medians)))
    table(["flag", "value counts", "related metric", "median by value"], rows)

    emit("## 7-5 image light and angle distribution (all images)")
    for k, c in image_values.items():
        table([f"images[].{k}", "count"], sorted(c.items()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", action="store_true", help="print key paths, types, and counts only")
    parser.add_argument("--margin", type=float, default=10.0, help="full-body filter margin in px")
    parser.add_argument("--bbox", choices=["auto", "xywh", "xyxy"], default="auto")
    parser.add_argument("--diagnose-only", action="store_true", help="stop after sections 4 and 5, skip section 7")
    args = parser.parse_args()
    zip_path = find_zip()
    if args.schema:
        run_schema(zip_path)
        return
    run_analysis(zip_path, args.margin, args.bbox, args.diagnose_only)
    path = DIAGNOSTICS_PATH if args.diagnose_only else RESULT_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out_lines) + "\n")
    print(f"Saved: {os.path.relpath(path, REPO)}")


if __name__ == "__main__":
    main()
