"""Builds explained/vegas-cold-tyres-flow.html: the ~90 s continuous explainer, in landscape (?land) or vertical (?port).
Data: vegas-flow-data.json (OpenF1 race weather + top-10 stints, 2023-25), temps-2025.json (median race track temp,
every 2025 GP) and ../vegas-preview-carousel/vegas-lap.json (2024 pole lap trace).
Usage: python3 explained/build-flow.py"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
flow = json.load(open(os.path.join(D, "vegas-flow-data.json")))
temps = json.load(open(os.path.join(D, "temps-2025.json")))
lap = json.load(open(os.path.join(D, "..", "vegas-preview-carousel", "vegas-lap.json")))
T = sorted([[x["short"].replace(" Circuit", ""), x["track"]] for x in temps], key=lambda x: -x[1])
# race-time track temperature, each Vegas race, from minute 4 (the first readings in 2025 spike to 24-28°C from grid heat)
NIGHT = {y: [[round(m, 1), tt] for m, tt, at in v["weather"] if m >= 4] for y, v in flow.items()}
STR = {y: [[t["code"], t["stints"]] for t in v["top10"]] for y, v in flow.items()}
data = ("const LAP = " + json.dumps(lap["trace"], separators=(",", ":")) + ";\n"
        "const TEMPS = " + json.dumps(T, separators=(",", ":")) + ";\n"
        "const NIGHT = " + json.dumps(NIGHT, separators=(",", ":")) + ";\n"
        "const STINTS = " + json.dumps(STR, separators=(",", ":")) + ";\n")
tpl = open(os.path.join(D, "flow-template.html")).read()
open(os.path.join(D, "vegas-cold-tyres-flow.html"), "w").write(tpl.replace("/*DATA*/", data))
print("built", len(data), "bytes of data")
