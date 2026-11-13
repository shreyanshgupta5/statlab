"""Collect public, dated reviews about large appliances (low volume, public pages only).
Sources: Flipkart product reviews, Google Play reviews of retailer apps, raw complaint-forum pages."""
import csv
import datetime as dt
import json
import pathlib
import re
import threading
import time

import requests
from google_play_scraper import Sort, reviews, search

START = time.time()
BUDGET = 28 * 60
OUT = pathlib.Path("out")
(OUT / "html").mkdir(parents=True, exist_ok=True)
NOW = dt.datetime.now()
SINCE = NOW - dt.timedelta(days=185)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9"}
KEYWORDS = re.compile(
    r"\b(a\.?c|air ?conditioner|fridge|refrigerator|washing ?machine|dish ?washer|tv|television|"
    r"cooler|install\w*|technician|jeeves|appliance\w*|exchange)\b", re.I)
log = {"play": {}, "flipkart": {}, "pages": {}}


def left():
    return BUDGET - (time.time() - START)


# ---------- Google Play ----------
APPS = {"flipkart": ("com.flipkart.android", 120000),
        "amazon": ("in.amazon.mShop.android.shopping", 120000),
        "croma": ("com.app.stwtamr", 20000),
        "vijay_sales": ("com.vijaysales.www", 5000)}


def collect_play():
    for term in ["Reliance Digital", "Croma", "JioMart"]:
        try:
            log["play"]["search:" + term] = [(h.get("appId"), h.get("title"))
                                             for h in search(term, lang="en", country="in", n_hits=6)]
        except Exception as e:  # noqa: BLE001
            log["play"]["search:" + term] = str(e)[:100]
    rows = []
    for label, (app_id, cap) in APPS.items():
        token, scanned, oldest, kept, err = None, 0, None, 0, None
        try:
            while scanned < cap and left() > 0:
                batch, token = reviews(app_id, lang="en", country="in", sort=Sort.NEWEST,
                                       count=200, continuation_token=token)
                if not batch:
                    break
                scanned += len(batch)
                for r in batch:
                    oldest = r["at"]
                    text = r.get("content") or ""
                    if r["at"] >= SINCE and KEYWORDS.search(text):
                        kept += 1
                        rows.append([label, r["at"].date().isoformat(), r["score"],
                                     r.get("thumbsUpCount", 0), text.replace("\n", " ").strip()])
                if oldest < SINCE or getattr(token, "token", None) is None:
                    break
                time.sleep(0.2)
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"[:200]
        log["play"][label] = dict(app_id=app_id, scanned=scanned, kept=kept, error=err,
                                  oldest_scanned=oldest.isoformat() if oldest else None)
        print("play", label, log["play"][label], flush=True)
    with open(OUT / "play_reviews.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["platform", "date", "stars", "thumbs_up", "text"])
        w.writerows(rows)


# ---------- Flipkart ----------
QUERIES = [("ac", "1.5 ton split ac", 10), ("refrigerator", "double door refrigerator", 10),
           ("washing_machine", "fully automatic washing machine", 10),
           ("tv", "55 inch smart tv", 10), ("dishwasher", "dishwasher", 6),
           ("air_cooler", "air cooler", 6)]
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
session = requests.Session()
session.headers.update(HEADERS)


def get(url):
    for attempt in range(2):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            print("  status", r.status_code, url[:90], flush=True)
        except Exception as e:  # noqa: BLE001
            print("  error", type(e).__name__, url[:90], flush=True)
        time.sleep(6)
    return ""


def state(html):
    i = html.find("window.__INITIAL_STATE__")
    if i < 0:
        return {}
    try:
        return json.JSONDecoder().raw_decode(html[html.find("{", i):])[0]
    except Exception:  # noqa: BLE001
        return {}


def find_reviews(o, acc):
    if isinstance(o, dict):
        if {"rating", "text", "created"} <= set(o):
            acc.append(o)
        for v in o.values():
            find_reviews(v, acc)
    elif isinstance(o, list):
        for v in o:
            find_reviews(v, acc)


def in_window(created):
    c = (created or "").strip()
    m = re.match(r"(\d+)\s+months?\s+ago", c)
    if m:
        return int(m.group(1)) <= 6
    if "ago" in c or "oday" in c:
        return True
    m = re.match(r"([A-Z][a-z]{2}),\s*(\d{4})", c)
    if m and m.group(1) in MONTHS:
        return dt.datetime(int(m.group(2)), MONTHS[m.group(1)], 28) >= SINCE
    return False


def collect_flipkart():
    f = open(OUT / "flipkart_reviews.csv", "w", newline="", encoding="utf-8")
    w = csv.writer(f)
    w.writerow(["category", "product", "item_id", "stars", "created", "title", "text",
                "city", "state", "helpful", "certified_buyer"])
    fails = 0
    for cat, query, n_products in QUERIES:
        html = get("https://www.flipkart.com/search?q=" + query.replace(" ", "+"))
        seen, products = set(), []
        for link in re.findall(r'href="(/[^"]+/p/(itm[0-9a-z]+)\?[^"]*)"', html):
            pid = re.search(r"pid=([A-Z0-9]+)", link[0])
            if link[1] in seen or not pid:
                continue
            seen.add(link[1])
            products.append((link[0].split("/p/")[0].strip("/"), link[1], pid.group(1)))
        products = products[:n_products]
        log["flipkart"][cat] = {"products": len(products), "reviews": 0, "pages": 0}
        for slug, item, pid in products:
            for page in range(1, 11):
                if left() < 60 or fails >= 6:
                    break
                url = (f"https://www.flipkart.com/{slug}/product-reviews/{item}"
                       f"?pid={pid}&sortOrder=MOST_RECENT&page={page}")
                acc = []
                find_reviews(state(get(url)), acc)
                time.sleep(1.3)
                log["flipkart"][cat]["pages"] += 1
                if not acc:
                    fails += 1 if page == 1 else 0
                    break
                fails = 0
                fresh = [r for r in acc if in_window(r.get("created"))]
                for r in fresh:
                    loc = r.get("location") or {}
                    w.writerow([cat, slug[:90], item, r.get("rating"), r.get("created"),
                                r.get("title"), (r.get("text") or "").replace("\n", " ").strip(),
                                loc.get("city"), loc.get("state"), r.get("helpfulCount"),
                                r.get("certifiedBuyer")])
                log["flipkart"][cat]["reviews"] += len(fresh)
                if not fresh:
                    break
            f.flush()
        print("flipkart", cat, log["flipkart"][cat], flush=True)
    log["flipkart"]["consecutive_failures_at_end"] = fails
    f.close()


# ---------- Complaint forum raw pages (parsed offline) ----------
def collect_forum():
    base = "https://www.consumercomplaints.in"
    targets = [("flipkart", "/flipkart-b100087", 25), ("amazon", "/amazon-india-b106509", 12),
               ("croma", "/croma-b100476", 8), ("vijaysales", "/vijay-sales-b102570", 5)]
    for name, path, pages in targets:
        for p in range(1, pages + 1):
            if left() < 30:
                return
            html = get(base + path + (f"/page/{p}" if p > 1 else ""))
            if not html:
                break
            (OUT / "html" / f"cc_{name}_{p}.html").write_text(html, encoding="utf-8")
            log["pages"][name] = p
            time.sleep(1.5)
    html = get(base + "/?search=reliance+digital")
    (OUT / "html" / "cc_search_reliance.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    t = threading.Thread(target=collect_play)
    t.start()
    collect_forum()
    collect_flipkart()
    t.join()
    log["finished_utc"] = dt.datetime.utcnow().isoformat()
    (OUT / "run_log.json").write_text(json.dumps(log, indent=1, default=str))
    print(json.dumps(log, indent=1, default=str))
