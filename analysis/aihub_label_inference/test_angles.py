import unittest

from angles import (
    angle_between,
    ankle_height_diff,
    elbow_flexion,
    knee_flexion,
    max_or_none,
    neck_angle,
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


if __name__ == "__main__":
    unittest.main()
