"""Builds explained/who-wins-vegas.html (land/port via ?land / ?port) from who-wins-template.html.
All numbers are 2026 race data from OpenF1, produced by predict/analyse_2026.py and predict/model_2026.py.
Usage: python3 explained/build-who-wins.py"""
import json, os
D = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(D, "predict")
ch = json.load(open(os.path.join(P, "chances.json"))); fd = json.load(open(os.path.join(P, "findings.json")))
tracks = json.load(open(os.path.join(P, "tracks.json"))); lap = json.load(open(os.path.join(D, "..", "vegas-preview-carousel", "vegas-lap.json")))
reel = open(os.path.join(D, "..", "vegas-preview-carousel", "vegas-reel.html")).read()
helmet = reel[reel.index("const esc=(s)=>String(s)"):reel.index("// ---- scene content")]          # helmet() drawings, shared with the reels
# the four coldest dry races of 2026 (pole and winner checked against OpenF1 session results)
cold = [{"race": "Montréal", "temp": 17.9, "pole": "RUS", "win": "ANT"}, {"race": "Shanghai", "temp": 22.2, "pole": "ANT", "win": "ANT"},
        {"race": "Spa", "temp": 30.6, "pole": "ANT", "win": "ANT"}, {"race": "Suzuka", "temp": 34.0, "pole": "ANT", "win": "ANT"}]
pace = {t: fd["race_cold"]["teams"][t] for t in ("MER", "FER", "MCL", "RBR")}
form = [[c, int(v["pts"])] for c, v in list(fd["last5"].items())[:5]]                # top five of the last five races, plus Russell (he is in the verdict)
if "RUS" not in [c for c, _ in form]: form.append(["RUS", int(fd["last5"]["RUS"]["pts"])])
verwins = [{"race": "KUALA LUMPUR", "wet": True, "temp": 33.8}, {"race": "SINGAPORE", "wet": False, "temp": 42.6}, {"race": "MEXICO CITY", "wet": False, "temp": 42.2}]
j = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)
data = (f"const LAP = {j(lap['trace'])};\nconst TRACKS = {j(tracks)};\nconst COLD = {j(cold)};\nconst PACE = {j(pace)};\n"
        f"const FORM = {j(form)};\nconst VERWINS = {j(verwins)};\nconst CHANCES = {j(ch)};\n{helmet}\n")
tpl = open(os.path.join(D, "who-wins-template.html")).read()
open(os.path.join(D, "who-wins-vegas.html"), "w").write(tpl.replace("/*DATA*/", data))
print("built who-wins-vegas.html; form:", form, "; chances:", [(d["code"], d["chance"]) for d in ch["drivers"]], "others", ch["others"])
