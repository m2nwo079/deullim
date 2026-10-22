import unittest

from angles import (
    angle_between,
    ankle_height_diff,
    count_above,
    elbow_flexion,
    forearm_dir,
    hip_flexion,
    knee_ankle_gap,
    knee_flexion,
    max_or_none,
    min_or_none,
    neck_angle,
    neck_signed,
    trunk_angle,
    upperarm_angle,
)


class AngleTest(unittest.TestCase):
    def test_angle_between_basic_and_degenerate(self):
        self.assertAlmostEqual(angle_between((1, 0), (0, 1)), 90.0)
        self.assertAlmostEqual(angle_between((1, 0), (-1, 0)), 180.0)
        self.assertAlmostEqual(angle_between((2, 2), (1, 1)), 0.0)
        self.assertIsNone(angle_between((0, 0), (1, 0)))

    def test_trunk_angle_uses_image_up(self):
        # Neck straight above pelvis (smaller y) is upright.
        self.assertAlmostEqual(trunk_angle((100, 200), (100, 100)), 0.0)
        # Bent 45 degrees forward to the right.
        self.assertAlmostEqual(trunk_angle((100, 200), (200, 100)), 45.0)
        # Lying flat.
        self.assertAlmostEqual(trunk_angle((100, 200), (0, 200)), 90.0)
        self.assertIsNone(trunk_angle((5, 5), (5, 5)))

    def test_neck_angle(self):
        pelvis, neck = (0, 200), (0, 100)
        self.assertAlmostEqual(neck_angle(pelvis, neck, (0, 50)), 0.0)
        self.assertAlmostEqual(neck_angle(pelvis, neck, (50, 50)), 45.0)
        self.assertAlmostEqual(neck_angle(pelvis, neck, (50, 100)), 90.0)

    def test_upperarm_angle(self):
        neck, pelvis, shoulder = (0, 100), (0, 200), (20, 100)
        # Arm hanging down is parallel to neck->pelvis.
        self.assertAlmostEqual(upperarm_angle(neck, pelvis, shoulder, (20, 150)), 0.0)
        self.assertAlmostEqual(upperarm_angle(neck, pelvis, shoulder, (70, 100)), 90.0)
        self.assertAlmostEqual(upperarm_angle(neck, pelvis, shoulder, (20, 50)), 180.0)

    def test_elbow_and_knee_flexion(self):
        self.assertAlmostEqual(elbow_flexion((0, 0), (0, 10), (0, 20)), 0.0)
        self.assertAlmostEqual(elbow_flexion((0, 0), (0, 10), (10, 10)), 90.0)
        self.assertAlmostEqual(knee_flexion((0, 0), (0, 10), (10, 20)), 45.0)
        self.assertIsNone(knee_flexion((0, 0), (0, 0), (0, 20)))

    def test_ankle_height_diff(self):
        self.assertAlmostEqual(ankle_height_diff((0, 100), (0, 80), (0, 0), (40, 0)), 0.5)
        self.assertAlmostEqual(ankle_height_diff((0, 80), (0, 100), (0, 0), (40, 0)), 0.5)
        self.assertIsNone(ankle_height_diff((0, 1), (0, 2), (3, 3), (3, 3)))

    def test_max_or_none(self):
        self.assertEqual(max_or_none(10.0, 20.0), 20.0)
        self.assertIsNone(max_or_none(None, 20.0))

    def test_min_or_none(self):
        self.assertEqual(min_or_none(10.0, 20.0), 10.0)
        self.assertIsNone(min_or_none(10.0, None))

    def test_forearm_dir(self):
        elbow = (50, 100)
        self.assertAlmostEqual(forearm_dir(elbow, (50, 150)), 0.0)
        self.assertAlmostEqual(forearm_dir(elbow, (100, 100)), 90.0)
        self.assertAlmostEqual(forearm_dir(elbow, (0, 100)), 90.0)
        self.assertAlmostEqual(forearm_dir(elbow, (100, 50)), 135.0)
        self.assertAlmostEqual(forearm_dir(elbow, (50, 50)), 180.0)
        self.assertIsNone(forearm_dir(elbow, elbow))

    def test_hip_flexion(self):
        neck, pelvis, hip = (0, 100), (0, 200), (10, 200)
        # Thigh parallel to neck->pelvis is standing.
        self.assertAlmostEqual(hip_flexion(neck, pelvis, hip, (10, 300)), 0.0)
        self.assertAlmostEqual(hip_flexion(neck, pelvis, hip, (110, 200)), 90.0)
        self.assertAlmostEqual(hip_flexion(neck, pelvis, hip, (110, 300)), 45.0)
        self.assertIsNone(hip_flexion(neck, pelvis, hip, hip))

    def test_knee_ankle_gap(self):
        ls, rs = (0, 0), (40, 0)
        self.assertAlmostEqual(knee_ankle_gap((0, 100), (0, 140), ls, rs), 1.0)
        # Ankle above the knee is negative.
        self.assertAlmostEqual(knee_ankle_gap((0, 100), (0, 80), ls, rs), -0.5)
        self.assertIsNone(knee_ankle_gap((0, 100), (0, 140), ls, ls))

    def test_neck_signed_flexion_and_extension(self):
        pelvis, neck = (0, 200), (0, 100)
        nose_right, nose_left = (20, 90), (-20, 90)
        # Head tilts toward the nose: positive.
        self.assertAlmostEqual(neck_signed(pelvis, neck, (50, 50), nose_right, 0.05), 45.0)
        self.assertAlmostEqual(neck_signed(pelvis, neck, (-50, 50), nose_left, 0.05), 45.0)
        # Head tilts away from the nose: negative.
        self.assertAlmostEqual(neck_signed(pelvis, neck, (-50, 50), nose_right, 0.05), -45.0)
        self.assertAlmostEqual(neck_signed(pelvis, neck, (50, 50), nose_left, 0.05), -45.0)
        self.assertAlmostEqual(neck_signed(pelvis, neck, (0, 50), nose_right, 0.05), 0.0)

    def test_neck_signed_undetermined_and_missing(self):
        pelvis, neck, head = (0, 200), (0, 100), (50, 50)
        # Nose on the trunk line, and 0.02 of trunk length off it: below 0.05.
        self.assertIsNone(neck_signed(pelvis, neck, head, (0, 90), 0.05))
        self.assertIsNone(neck_signed(pelvis, neck, head, (2, 90), 0.05))
        self.assertIsNotNone(neck_signed(pelvis, neck, head, (2, 90), 0.01))
        self.assertIsNone(neck_signed(pelvis, neck, None, (20, 90), 0.05))
        self.assertIsNone(neck_signed(pelvis, pelvis, head, (20, 90), 0.05))

    def test_count_above(self):
        left_sh, right_sh = (0, 100), (40, 100)
        self.assertEqual(count_above([(left_sh, (0, 150)), (right_sh, (40, 150))]), 0)
        self.assertEqual(count_above([(left_sh, (0, 50)), (right_sh, (40, 150))]), 1)
        self.assertEqual(count_above([(left_sh, (0, 50)), (right_sh, (40, 50))]), 2)
        # Same height is not above.
        self.assertEqual(count_above([(left_sh, (0, 100)), (right_sh, (40, 100))]), 0)
        # One side missing.
        self.assertIsNone(count_above([(left_sh, (0, 50)), (right_sh, None)]))
        self.assertIsNone(count_above([(None, (0, 50)), (right_sh, (40, 50))]))


if __name__ == "__main__":
    unittest.main()
