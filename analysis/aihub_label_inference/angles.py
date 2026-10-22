"""Pure 2D joint angle functions in the image plane (degrees).

Points are (x, y) tuples in image coordinates, so y grows downward.
Every function returns None when a needed vector has zero length.
"""
import math

UP = (0.0, -1.0)


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


def max_or_none(a, b):
    return None if a is None or b is None else max(a, b)
