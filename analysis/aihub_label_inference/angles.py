"""Pure 2D joint angle functions in the image plane (degrees).

Points are (x, y) tuples in image coordinates, so y grows downward.
Every function returns None when a needed vector has zero length.
"""
import math

UP = (0.0, -1.0)
DOWN = (0.0, 1.0)


def vec(a, b):
    return (b[0] - a[0], b[1] - a[1])


def angle_between(v1, v2):
    if math.hypot(*v1) == 0 or math.hypot(*v2) == 0:
        return None
    # atan2 stays precise near 0 and 180 degrees, where acos loses digits.
    cross = v1[0] * v2[1] - v1[1] * v2[0]
    dot = v1[0] * v2[0] + v1[1] * v2[1]
    return math.degrees(math.atan2(abs(cross), dot))


def interior_angle(a, b, c):
    return angle_between(vec(b, a), vec(b, c))


def trunk_angle(pelvis, neck):
    return angle_between(UP, vec(pelvis, neck))


def neck_angle(pelvis, neck, head):
    return angle_between(vec(pelvis, neck), vec(neck, head))


def upperarm_angle(neck, pelvis, shoulder, elbow):
    return angle_between(vec(neck, pelvis), vec(shoulder, elbow))


def flexion(a, b, c):
    inner = interior_angle(a, b, c)
    return None if inner is None else 180.0 - inner


def elbow_flexion(shoulder, elbow, wrist):
    return flexion(shoulder, elbow, wrist)


def knee_flexion(hip, knee, ankle):
    return flexion(hip, knee, ankle)


def ankle_height_diff(left_ankle, right_ankle, left_shoulder, right_shoulder):
    shoulder_width = math.dist(left_shoulder, right_shoulder)
    if shoulder_width == 0:
        return None
    return abs(left_ankle[1] - right_ankle[1]) / shoulder_width


def forearm_dir(elbow, wrist):
    """0 when the forearm hangs straight down, 180 when it points straight up."""
    return angle_between(DOWN, vec(elbow, wrist))


def hip_flexion(neck, pelvis, hip, knee):
    return angle_between(vec(neck, pelvis), vec(hip, knee))


def knee_ankle_gap(knee, ankle, left_shoulder, right_shoulder):
    shoulder_width = math.dist(left_shoulder, right_shoulder)
    if shoulder_width == 0:
        return None
    return (ankle[1] - knee[1]) / shoulder_width


def max_or_none(a, b):
    return None if a is None or b is None else max(a, b)


def min_or_none(a, b):
    return None if a is None or b is None else min(a, b)


def cross(v1, v2):
    return v1[0] * v2[1] - v1[1] * v2[0]


def neck_signed(pelvis, neck, head, nose, min_ratio):
    """Signed angle from pelvis->neck to neck->head; positive toward the nose side.

    Returns None when a point is missing (None), a vector has zero length, or the
    nose-to-trunk-line distance / trunk length is below min_ratio.
    """
    if any(p is None for p in (pelvis, neck, head, nose)):
        return None
    trunk = vec(pelvis, neck)
    head_vec = vec(neck, head)
    trunk_sq = trunk[0] ** 2 + trunk[1] ** 2
    if trunk_sq == 0 or head_vec == (0, 0):
        return None
    # |cross| / |trunk| is the nose distance to the trunk line; divide by |trunk| again for the ratio.
    facing = cross(trunk, vec(neck, nose))
    if abs(facing) / trunk_sq < min_ratio:
        return None
    dot = trunk[0] * head_vec[0] + trunk[1] * head_vec[1]
    signed = math.degrees(math.atan2(cross(trunk, head_vec), dot))
    return signed if facing > 0 else -signed


def count_above(pairs):
    """Count (shoulder, point) pairs whose point is above the shoulder (smaller y); None if any point is None."""
    if any(s is None or p is None for s, p in pairs):
        return None
    return sum(p[1] < s[1] for s, p in pairs)
