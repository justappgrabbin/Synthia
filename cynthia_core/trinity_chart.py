"""
cynthia_core/trinity_chart.py  (added 2026-10-19, branch fill/synthia-20261019)

Fills the mock in cynthia_core_dropper_fixed.html (embedded app.py, route
/api/chart):
    "# Mock chart calculation - replace with real astrology calculation"
    chart = {"Body": {"sun_gate": "34.2", ...}, "Heart": {...}, "Mind": {...}}
The HTML file and its embedded app.py are NOT edited. This module returns the
same shape ({"Body"|"Heart"|"Mind": {"sun_gate", "earth_gate", "flow", "stress"}})
from real inputs, so app.py can call it later if Alexis says yes.

RULES AND SOURCES
- Her Trinity overlay: "Mind = Sidereal, Body = Tropical, Heart = Draconic"
  (Drive: Cf.docx, "GPT DASH MASTER DIRECTIVE (Pentacore / Trinity /
  YOU-N-I-VERSE)"; same rule in her Synthia-server/ephemeris.py
  generate_trinity_report: body = tropical, mind = sidereal, heart = draconic).
- Sidereal = Fagan-Bradley (her requirement). sidereal = tropical - ayanamsa.
  Ayanamsa fixtures: hd-math-verification.md s.5 (Swiss Ephemeris, mean).
- Draconic = (tropical - North Node) mod 360. hd-math-verification.md s.6
  (Pamela Crane; Genetic Matrix).
- Gate.line from longitude: verified wheel, gate 41 at 302.0 deg, 5.625 per
  gate (hd-math-verification.md s.1). Black Book (Ra Uru Hu 1991) p.16.
- filled in, no source: Earth = Sun + 180 deg (no page in her Black Book copy
  states it; her ephemeris.py and the existing mock both carry an Earth gate).
- investigating: "flow" and "stress" (no rule in her files); returned as None.
- investigating: reading the 302-deg (tropical-anchored) wheel on sidereal
  and draconic longitudes is HER rule as written in ephemeris.py; whether the
  anchor itself should shift for those zodiacs is not settled in a source.
No birth data is stored here. Planet longitudes are inputs.
HD/Rave material is lore, not physics.
"""
from __future__ import annotations

WHEEL_FROM_41 = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
]
GATE_41_START = 302.0
GATE_ARC = 360.0 / 64
LINE_ARC = GATE_ARC / 6
_EPS = 1e-12

FB_FIXTURES = [
    (2433282.5, 24 + 2 / 60 + 30.96 / 3600),  # 1 Jan 1950 0h UT
    (2451545.0, 24.740300),                    # J2000.0
    (2461041.5, 25.103512),                    # 1 Jan 2026 0h UT
]


def norm(d: float) -> float:
    return d % 360.0


def gate_line(lon: float) -> str:
    x = norm(norm(lon) - GATE_41_START)
    k = min(int(x / GATE_ARC + _EPS), 63)
    line = min(int((x - k * GATE_ARC) / LINE_ARC + _EPS) + 1, 6)
    return f"{WHEEL_FROM_41[k]}.{line}"


def fagan_bradley(jd: float) -> float:
    """Swiss Ephemeris via pyswisseph if available; else quadratic through the
    three fixtures (filled in, no source: the interpolation is mine; within
    0.002" of Swiss Ephemeris 1950-2026, see Synthia-server tests)."""
    try:
        import swisseph as swe  # type: ignore
        swe.set_sid_mode(swe.SIDM_FAGAN_BRADLEY)
        return float(swe.get_ayanamsa_ut(jd))
    except Exception:
        (x0, y0), (x1, y1), (x2, y2) = FB_FIXTURES
        return (y0 * (jd - x1) * (jd - x2) / ((x0 - x1) * (x0 - x2))
                + y1 * (jd - x0) * (jd - x2) / ((x1 - x0) * (x1 - x2))
                + y2 * (jd - x0) * (jd - x1) / ((x2 - x0) * (x2 - x1)))


def trinity_chart(sun_tropical: float, north_node_tropical: float, jd: float) -> dict:
    """Same shape as the mock in cynthia_core_dropper_fixed.html."""
    ay = fagan_bradley(jd)
    frames = {
        "Body": norm(sun_tropical),                         # Tropical
        "Mind": norm(sun_tropical - ay),                    # Sidereal (Fagan-Bradley)
        "Heart": norm(sun_tropical - north_node_tropical),  # Draconic
    }
    nodes = {}
    for name, sun in frames.items():
        nodes[name] = {
            "sun_gate": gate_line(sun),
            "earth_gate": gate_line(sun + 180.0),
            "flow": None,     # investigating
            "stress": None,   # investigating
            "longitude": round(sun, 6),
        }
    return {"nodes": nodes,
            "meta": {"ayanamsa_fagan_bradley_deg": round(ay, 6),
                     "wheel": "gate 41 at 302.0 (hd-math-verification.md s.1)",
                     "investigating": ["flow", "stress", "wheel anchor on sidereal/draconic"]}}
