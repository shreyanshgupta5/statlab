"""Furniture study: Flipkart reviews and buyer questions, app reviews, complaint forum, Desidime, IKEA reviews.
Public pages only, low volume. Output to ./out, encrypted by the workflow."""
import csv
import datetime as dt
import json
import pathlib
import re
import threading
import time

import requests
from google_play_scraper import Sort, reviews
from playwright.sync_api import sync_playwright

START = time.time()
BUDGET = 40 * 60
OUT = pathlib.Path("out")
for d in ("html", "fkq", "dd", "ikea"):
    (OUT / d).mkdir(parents=True, exist_ok=True)
NOW = dt.datetime.now()
SINCE = NOW - dt.timedelta(days=185)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
FURN = re.compile(r"\b(sofa|couch|recliner|bed|cot|wardrobe|almirah|cupboard|dining|table|chair|furniture|"
                  r"tv unit|tv stand|shoe rack|bookshelf|cabinet|assembl\w*|carpenter|ikea|pepperfry|"
                  r"urban ladder|wakefit|home ?centre)\b", re.I)
log = {"play": {}, "fk": {}, "fkq": {}, "cc": {}, "dd": {}, "ikea": {}}


def left():
    return BUDGET - (time.time() - START)


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9"})
    return s


def get(s, url):
    for _ in range(2):
        try:
            r = s.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
        except Exception:  # noqa: BLE001
            pass
        time.sleep(5)
    return ""


# ---------- Google Play ----------
APPS = {"pepperfry": ("com.app.pepperfry", 30000, False), "urban_ladder": ("com.urbanladder.catalog", 30000, False),
        "ikea": ("com.ingka.ikea.app", 30000, False), "wakefit": ("wakefit.co.mobile", 30000, False),
        "home_centre": ("com.applications.homecentre", 30000, False),
        "flipkart": ("com.flipkart.android", 80000, True), "amazon": ("in.amazon.mShop.android.shopping", 80000, True)}


def collect_play():
    rows = []
    for label, (app_id, cap, need_kw) in APPS.items():
        token, scanned, kept, oldest, err = None, 0, 0, None, None
        try:
            while scanned < cap and left() > 120:
                batch, token = reviews(app_id, lang="en", country="in", sort=Sort.NEWEST,
                                       count=200, continuation_token=token)
                if not batch:
                    break
                scanned += len(batch)
                for r in batch:
                    oldest = r["at"]
                    text = (r.get("content") or "").replace("\n", " ").strip()
                    if r["at"] >= SINCE and (not need_kw or FURN.search(text)):
                        kept += 1
                        rows.append([label, r["at"].date().isoformat(), r["score"], r.get("thumbsUpCount", 0), text])
                if oldest < SINCE or getattr(token, "token", None) is None:
                    break
                time.sleep(0.2)
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"[:200]
        log["play"][label] = dict(app_id=app_id, scanned=scanned, kept=kept, error=err,
                                  oldest=oldest.isoformat() if oldest else None)
        print("play", label, log["play"][label], flush=True)
    with open(OUT / "play_reviews.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["platform", "date", "stars", "thumbs_up", "text"])
        w.writerows(rows)


# ---------- Complaint forum + Desidime ----------
STRIP = re.compile(r"<(script|style|svg|noscript|head)\b.*?</\1>", re.S | re.I)
CC = [("pepperfry", "/pepperfry-b101387", 15), ("urban_ladder", "/urban-ladder-b113513", 8),
      ("flipkart", "/flipkart-b100087", 20), ("amazon", "/amazon-india-b106509", 10)]
CC_SEARCH = [("wakefit", "wakefit"), ("ikea", "ikea"), ("home_centre", "home+centre"), ("godrej_interio", "godrej+interio")]
DD_KW = ["sofa", "bed with storage", "wardrobe", "dining table", "office chair", "study table", "furniture",
         "pepperfry", "urban ladder", "wakefit", "ikea", "furniture assembly"]


def collect_forums():
    s = session()
    base = "https://www.consumercomplaints.in"
    for name, path, pages in CC:
        for p in range(1, pages + 1):
            if left() < 300:
                break
            html = get(s, base + path + (f"/page/{p}" if p > 1 else ""))
            if not html:
                break
            (OUT / "html" / f"cc_{name}_{p}.html").write_text(STRIP.sub("", html), encoding="utf-8")
            log["cc"][name] = p
            time.sleep(1.5)
    for name, q in CC_SEARCH:
        html = get(s, f"{base}/?search={q}")
        (OUT / "html" / f"cc_{name}_1.html").write_text(STRIP.sub("", html), encoding="utf-8")
        log["cc"][name] = 1 if html else 0
        time.sleep(1.5)
    threads = {}
    for kw in DD_KW:
        for page in (1, 2):
            url = (f"https://www.desidime.com/selective_search?date_range=all_time&keyword={kw.replace(' ', '+')}"
                   f"&search_list=discussions&search_terms=title%2Cdescription%2Ccomments&sort_type=new&page={page}")
            html = get(s, url)
            for href, title in re.findall(r'<a[^>]+href="(/discussions/[a-z0-9-]+)"[^>]*>([^<]{8,200})</a>', html):
                if href not in threads and FURN.search(title):
                    threads[href] = (title.strip(), kw)
            time.sleep(1.5)
            if not html:
                break
    index = []
    for i, (href, (title, kw)) in enumerate(list(threads.items())[:150]):
        if left() < 200:
            break
        html = get(s, "https://www.desidime.com" + href)
        if html:
            dates = re.findall(r'"(?:datePublished|dateCreated)":\s*"([^"]+)"', html)
            (OUT / "dd" / f"t{i}.html").write_text(STRIP.sub("", html), encoding="utf-8")
            index.append({"i": i, "href": href, "title": title, "kw": kw, "dates": dates[:2]})
        time.sleep(1.5)
    (OUT / "dd" / "index.json").write_text(json.dumps(index, indent=0))
    log["dd"] = {"found": len(threads), "saved": len(index)}
    print("forums", log["cc"], log["dd"], flush=True)


# ---------- Flipkart reviews ----------
QUERIES = [("sofa", "3 seater sofa", 8), ("tv_unit", "tv unit", 8), ("bed", "king size bed with storage", 8),
           ("wardrobe", "3 door wardrobe", 8), ("dining", "6 seater dining table set", 8),
           ("office_chair", "office chair", 8), ("study_table", "study table", 8)]
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


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


def in_window(c):
    c = (c or "").strip()
    m = re.match(r"(\d+)\s+months?\s+ago", c)
    if m:
        return int(m.group(1)) <= 6
    if "ago" in c or "oday" in c:
        return True
    m = re.match(r"([A-Z][a-z]{2}),\s*(\d{4})", c)
    if m and m.group(1) in MONTHS:
        return dt.datetime(int(m.group(2)), MONTHS[m.group(1)], 28) >= SINCE
    return False


def fk_products(s):
    products = []
    for cat, query, n in QUERIES:
        html = get(s, "https://www.flipkart.com/search?q=" + query.replace(" ", "+"))
        seen = set()
        for link, item in re.findall(r'href="(/[^"]+/p/(itm[0-9a-z]+)\?[^"]*)"', html):
            pid = re.search(r"pid=([A-Z0-9]+)", link)
            if item in seen or not pid:
                continue
            seen.add(item)
            products.append((cat, link.split("/p/")[0].strip("/"), item, pid.group(1)))
            if len(seen) == n:
                break
        time.sleep(2)
    return products


def collect_flipkart(products):
    s = session()
    with open(OUT / "flipkart_reviews.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["category", "product", "item_id", "stars", "created", "title", "text", "city", "state",
                    "helpful", "certified_buyer"])
        for cat, slug, item, pid in products:
            log["fk"].setdefault(cat, {"products": 0, "reviews": 0})
            log["fk"][cat]["products"] += 1
            for page in range(1, 11):
                if left() < 900:
                    break
                acc = []
                find_reviews(state(get(s, f"https://www.flipkart.com/{slug}/product-reviews/{item}"
                                          f"?pid={pid}&sortOrder=MOST_RECENT&page={page}")), acc)
                time.sleep(1.2)
                fresh = [r for r in acc if in_window(r.get("created"))]
                for r in fresh:
                    loc = r.get("location") or {}
                    w.writerow([cat, slug[:90], item, r.get("rating"), r.get("created"), r.get("title"),
                                (r.get("text") or "").replace("\n", " ").strip(), loc.get("city"), loc.get("state"),
                                r.get("helpfulCount"), r.get("certifiedBuyer")])
                log["fk"][cat]["reviews"] += len(fresh)
                if not acc or not fresh:
                    break
            f.flush()
    print("flipkart", log["fk"], flush=True)


# ---------- Browser: Flipkart questions, IKEA reviews ----------
IKEA_CATS = [("sofa", "sofas-fu003"), ("tv_unit", "tv-media-furniture-10475"), ("bed", "beds-bm003"),
             ("wardrobe", "wardrobes-19053"), ("dining", "dining-sets-19145"), ("office_chair", "office-chairs-20652"),
             ("study_table", "desks-computer-desks-20649")]


def collect_browser(products):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(locale="en-IN", user_agent=UA, viewport={"width": 1366, "height": 900})
        page = ctx.new_page()
        captured = []

        def on_resp(resp):
            try:
                if "json" in (resp.headers.get("content-type") or "") and len(captured) < 15:
                    body = resp.text()
                    if re.search(r'"(?:review|reviewText|text|comment)"', body) and re.search(r'rating', body, re.I):
                        captured.append({"url": resp.url[:200], "body": body[:400000]})
            except Exception:  # noqa: BLE001
                pass

        page.on("response", on_resp)

        def visit(url):
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:  # noqa: BLE001
                pass

        ok = 0
        for i, (cat, slug, item, pid) in enumerate(products):
            if left() < 400:
                break
            rec = {"category": cat, "slug": slug, "item": item, "pages": []}
            for pg in (1, 2):
                try:
                    visit(f"https://www.flipkart.com/{slug}/product-questions/{item}?pid={pid}&page={pg}")
                    rec["pages"].append({"page": pg, "text": page.inner_text("body")[:40000]})
                except Exception as e:  # noqa: BLE001
                    rec["pages"].append({"page": pg, "text": "ERROR " + type(e).__name__})
                time.sleep(1.2)
            ok += any("Q:" in x["text"] for x in rec["pages"])
            (OUT / "fkq" / f"p{i}.json").write_text(json.dumps(rec))
        log["fkq"] = {"products": len(products), "with_questions": ok}
        print("fk questions", log["fkq"], flush=True)

        for cat, path in IKEA_CATS:
            if left() < 120:
                break
            try:
                visit(f"https://www.ikea.com/in/en/cat/{path}/")
                html = page.content()
            except Exception:  # noqa: BLE001
                continue
            items = []
            for m in re.finditer(r'"url":"(https://www\.ikea\.com/in/en/p/[^"]+)"[^{}]*?"aggregateRating":\{[^}]*"reviewCount":(\d+)', html):
                if int(m.group(2)) > 0 and m.group(1) not in [x[0] for x in items]:
                    items.append((m.group(1), int(m.group(2))))
            items.sort(key=lambda x: -x[1])
            log["ikea"][cat] = {"products_with_reviews": len(items), "visited": 0}
            for j, (url, n) in enumerate(items[:5]):
                if left() < 120:
                    break
                captured.clear()
                try:
                    visit(url)
                    for label in ["Reviews", "reviews", "Customer reviews", "See all reviews"]:
                        btn = page.get_by_text(label, exact=False).first
                        if btn.count():
                            try:
                                btn.click(timeout=3000)
                                page.wait_for_timeout(3000)
                                break
                            except Exception:  # noqa: BLE001
                                pass
                    text = page.inner_text("body")[:60000]
                except Exception as e:  # noqa: BLE001
                    text = "ERROR " + type(e).__name__
                (OUT / "ikea" / f"{cat}_{j}.json").write_text(json.dumps({"url": url, "review_count": n,
                                                                          "text": text, "json": list(captured)}))
                log["ikea"][cat]["visited"] += 1
                time.sleep(2)
        print("ikea", log["ikea"], flush=True)
        b.close()


if __name__ == "__main__":
    t1 = threading.Thread(target=collect_play)
    t2 = threading.Thread(target=collect_forums)
    t1.start()
    t2.start()
    prods = fk_products(session())
    collect_flipkart(prods)
    collect_browser(prods)
    t1.join()
    t2.join()
    log["finished_utc"] = dt.datetime.utcnow().isoformat()
    (OUT / "run_log.json").write_text(json.dumps(log, indent=1, default=str))
    print(json.dumps(log, indent=1, default=str))
