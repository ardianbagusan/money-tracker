"""Renders the watercolour SVGs from landscape.mjs into JPGs in public/art/.

Usage (from the project folder):  python3 scripts/render-art.py
Needs: Node, and Python Playwright with Chromium (pip install playwright; playwright install chromium).
"""
import json, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "public" / "art"
out.mkdir(parents=True, exist_ok=True)

# name, variant, width, height, options
JOBS = [
    ("hero-dawn", "dawn", 1600, 640, {}),
    ("hero-day", "day", 1600, 640, {}),
    ("hero-dusk", "dusk", 1600, 640, {}),
    ("hero-night", "night", 1600, 640, {}),
    ("backdrop", "night", 1800, 1200, {"horizon": 0.62, "sunX": 0.78, "seed": 12}),
    ("login", "dusk", 1200, 1600, {"horizon": 0.6, "sunX": 0.6, "seed": 4}),
    # Mood weather for the overview: 1 storm ... 5 radiant
    ("mood-1", "storm", 1600, 640, {}),
    ("mood-2", "rain", 1600, 640, {}),
    ("mood-3", "cloudy", 1600, 640, {}),
    ("mood-4", "sunny", 1600, 640, {}),
    ("mood-5", "radiant", 1600, 640, {}),
]

only = set(sys.argv[1:])
script = "import {landscapeSVG} from './landscape.mjs';const j=JSON.parse(process.argv[1]);process.stdout.write(landscapeSVG(j.v,j.w,j.h,j.o));"

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for name, variant, w, h, opts in JOBS:
        if only and name not in only:
            continue
        svg = subprocess.run(
            ["node", "--input-type=module", "-e", script, json.dumps({"v": variant, "w": w, "h": h, "o": opts})],
            cwd=root / "scripts", capture_output=True, text=True, check=True,
        ).stdout
        page = browser.new_page(viewport={"width": w, "height": h})
        page.set_content(f"<html><body style='margin:0'>{svg}</body></html>")
        page.wait_for_timeout(300)
        page.screenshot(path=str(out / f"{name}.jpg"), type="jpeg", quality=84)
        page.close()
        print("wrote", name)
    browser.close()
