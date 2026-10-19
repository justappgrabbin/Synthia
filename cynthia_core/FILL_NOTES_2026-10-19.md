# Fill notes, 2026-10-19 (branch fill/synthia-20261019, local only, not pushed)

Additions only (cynthia_core/). No existing file edited; zips untouched.

- trinity_chart.py: real Body/Mind/Heart Sun and Earth gate.line from a tropical Sun longitude, a North Node longitude and a Julian day. Same output shape as the mock in cynthia_core_dropper_fixed.html /api/chart.
  - Body = Tropical, Mind = Sidereal (Fagan-Bradley), Heart = Draconic: her rule (Drive Cf.docx "GPT DASH MASTER DIRECTIVE"; her ephemeris.py).
  - Wheel: hd-math-verification.md s.1; Black Book 1991 p.16. Draconic: s.6. Fagan-Bradley: s.5.
- filled in, no source: Earth = Sun + 180; ayanamsa quadratic fallback.
- investigating: flow, stress (returned as None); whether the wheel anchor should move for sidereal/draconic.
- Not filled: SYNTH_OS_*.html ctxRename/ctxDelete ("not implemented" toasts) - UI, would need editing her HTML.
- Run: `python3 -m unittest cynthia_core.tests.test_trinity_chart -v` -> 4 tests OK.
