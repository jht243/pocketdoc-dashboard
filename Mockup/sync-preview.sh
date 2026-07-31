#!/bin/bash
# Sync the ported mockup into the browser-preview copy.
# Adds a React mount point and lets ?screen=<name> jump straight to any screen
# (review aid only — the source file is untouched).
cd "$(dirname "$0")"
SRC="health-advocate-app-mockup (2).jsx"
OUT="_preview_app.jsx"

python3 - "$SRC" "$OUT" <<'PY'
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
s = s.replace(
    'const [active, setActive] = useState("onboarding");',
    'const [active, setActive] = useState(new URLSearchParams(location.search).get("screen") || "onboarding");'
)
s += """

// ---- preview mount (harness only) ----
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render(<App />);
"""
open(out, "w", encoding="utf-8").write(s)
print("synced ->", out)
PY
