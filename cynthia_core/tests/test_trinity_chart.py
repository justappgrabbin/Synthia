"""Run from repo root: python3 -m unittest cynthia_core.tests.test_trinity_chart -v
Synthetic longitudes only, no birth data."""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from cynthia_core import trinity_chart as tc

TABLE = "/workspace/research/calc/gate_table.md"


class T(unittest.TestCase):
    def test_wheel(self):
        self.assertEqual(tc.gate_line(302.0), "41.1")
        self.assertEqual(tc.gate_line(358.25), "25.1")
        self.assertEqual(tc.gate_line(10.0).split(".")[0], "21")

    @unittest.skipUnless(os.path.exists(TABLE), "verified table not here")
    def test_table(self):
        with open(TABLE) as fh:
            rows = [l for l in fh if l.startswith("| ") and "**" in l]
        for r in rows:
            c = [s.strip() for s in r.split("|")]
            self.assertEqual(tc.gate_line(float(c[3]) + 1e-6), f"{int(c[2].strip('*'))}.1")

    def test_shape_matches_mock(self):
        out = tc.trinity_chart(302.5, 100.0, 2451545.0)["nodes"]
        self.assertEqual(set(out), {"Body", "Heart", "Mind"})
        for n in out.values():
            self.assertEqual({"sun_gate", "earth_gate", "flow", "stress"} <= set(n), True)
            self.assertIsNone(n["flow"]); self.assertIsNone(n["stress"])

    def test_frames(self):
        out = tc.trinity_chart(302.5, 100.0, 2451545.0)["nodes"]
        self.assertAlmostEqual(out["Body"]["longitude"], 302.5)
        self.assertAlmostEqual(out["Mind"]["longitude"], 302.5 - 24.7403, places=4)
        self.assertAlmostEqual(out["Heart"]["longitude"], 202.5)
        self.assertEqual(out["Body"]["sun_gate"], "41.1")
        self.assertEqual(out["Body"]["earth_gate"], tc.gate_line(122.5))
        # North Node itself lands at 0 Aries in the draconic frame -> gate 25 line 2 (s.6)
        self.assertEqual(tc.gate_line(tc.norm(100.0 - 100.0)), "25.2")


if __name__ == "__main__":
    unittest.main()
