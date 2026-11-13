"""Collect pre-purchase signals: Flipkart buyer questions and Desidime advice threads. Public pages, low volume."""
import json
import pathlib
import re
import threading
import time

import requests
from playwright.sync_api import sync_playwright

START = time.time()
BUDGET = 30 * 60
OUT = pathlib.Path("out")
(OUT / "dd").mkdir(parents=True, exist_ok=True)
(OUT / "fk").mkdir(parents=True, exist_ok=True)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
log = {"dd": {}, "fk": {}}


def left():
    return BUDGET - (time.time() - START)


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9"})
    return s


def get(s, url):
    try:
        r = s.get(url, timeout=30)
        return r.text if r.status_code == 200 else ""
    except Exception:  # noqa: BLE001
        return ""


# ---------- Desidime ----------
APPL = re.compile(r"\b(a\.?c|acs|air ?conditioners?|fridge|refrigerators?|washing ?machines?|dish ?washers?|"
                  r"tv|tvs|television|cooler|appliances?|installation|open box|exchange)\b", re.I)
KEYWORDS = ["air conditioner", "split ac", "ac installation", "refrigerator", "fridge", "washing machine",
            "dishwasher", "smart tv", "television", "open box delivery", "appliance exchange",
            "jeeves", "large appliance", "installation charges"]
GROUPS = ["air-conditioners", "refrigerators", "tv", "washing-machine", "kitchen-appliances", "electronics"]
STRIP = re.compile(r"<(script|style|svg|noscript|head)\b.*?</\1>", re.S | re.I)


def collect_desidime():
    s = session()
    base = "https://www.desidime.com"
    threads = {}

    def harvest(html, src):
        for href, title in re.findall(r'<a[^>]+href="(/discussions/[a-z0-9-]+)"[^>]*>([^<]{8,200})</a>', html):
            title = title.strip()
            if href not in threads and APPL.search(title):
                threads[href] = (title, src)

    for kw in KEYWORDS:
        for page in range(1, 4):
            url = (f"{base}/selective_search?date_range=all_time&keyword={kw.replace(' ', '+')}"
                   f"&search_list=discussions&search_terms=title%2Cdescription%2Ccomments&sort_type=new&page={page}")
            html = get(s, url)
            before = len(threads)
            harvest(html, "search:" + kw)
            log["dd"][f"search:{kw}:{page}"] = [len(html), len(threads) - before]
            time.sleep(1.5)
            if not html:
                break
    for g in GROUPS:
        for suffix in ["", "/discussions", "?type=discussions"]:
            html = get(s, f"{base}/groups/{g}{suffix}")
            before = len(threads)
            harvest(html, "group:" + g)
            log["dd"][f"group:{g}{suffix}"] = [len(html), len(threads) - before]
            if suffix == "":
                (OUT / "dd" / f"_group_{g}.html").write_text(STRIP.sub("", html), encoding="utf-8")
            time.sleep(1.5)
    index = []
    for i, (href, (title, src)) in enumerate(list(threads.items())[:350]):
        if left() < 60:
            break
        html = get(s, base + href)
        if html:
            dates = re.findall(r'"(?:datePublished|dateCreated)":\s*"([^"]+)"', html)
            (OUT / "dd" / f"t{i}.html").write_text(STRIP.sub("", html), encoding="utf-8")
            index.append({"i": i, "href": href, "title": title, "src": src, "dates": dates[:2]})
        time.sleep(1.5)
    (OUT / "dd" / "index.json").write_text(json.dumps(index, indent=0))
    log["dd"]["threads_found"] = len(threads)
    log["dd"]["threads_saved"] = len(index)
    print("desidime", log["dd"]["threads_found"], log["dd"]["threads_saved"], flush=True)


# ---------- Flipkart buyer questions ----------
QUERIES = [("ac", "1.5 ton split ac", 10), ("refrigerator", "double door refrigerator", 10),
           ("washing_machine", "fully automatic washing machine", 10),
           ("tv", "55 inch smart tv", 10), ("dishwasher", "dishwasher", 5),
           ("air_cooler", "air cooler", 5)]


def collect_flipkart():
    s = session()
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
    log["fk"]["products"] = len(products)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(locale="en-IN", user_agent=UA, viewport={"width": 1366, "height": 900})
        page = ctx.new_page()
        captured = []

        def on_response(resp):
            try:
                if "json" in (resp.headers.get("content-type") or "") and len(captured) < 12:
                    body = resp.text()
                    if re.search(r'"question|"answer', body, re.I):
                        captured.append({"url": resp.url[:200], "body": body[:300000]})
            except Exception:  # noqa: BLE001
                pass

        page.on("response", on_response)
        ok = 0
        for i, (cat, slug, item, pid) in enumerate(products):
            if left() < 90:
                break
            rec = {"category": cat, "slug": slug, "item": item, "pages": []}
            for pg in (1, 2):
                captured.clear()
                url = f"https://www.flipkart.com/{slug}/product-questions/{item}?pid={pid}&page={pg}"
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=40000)
                    try:
                        page.wait_for_load_state("networkidle", timeout=9000)
                    except Exception:  # noqa: BLE001
                        pass
                    text = page.inner_text("body")[:40000]
                    final = page.url
                except Exception as e:  # noqa: BLE001
                    text, final = "ERROR " + type(e).__name__, ""
                rec["pages"].append({"page": pg, "final_url": final[:200], "text": text,
                                     "json": list(captured)})
                if i == 0 and pg == 1:
                    (OUT / "fk" / "_sample_rendered.html").write_text(page.content(), encoding="utf-8")
                time.sleep(1.5)
            if any(len(x["json"]) or "?" in x["text"] for x in rec["pages"]):
                ok += 1
            (OUT / "fk" / f"p{i}.json").write_text(json.dumps(rec))
        log["fk"]["products_with_content"] = ok
        browser.close()
    print("flipkart", log["fk"], flush=True)


if __name__ == "__main__":
    t = threading.Thread(target=collect_desidime)
    t.start()
    try:
        collect_flipkart()
    except Exception as e:  # noqa: BLE001
        log["fk"]["error"] = f"{type(e).__name__}: {e}"[:300]
    t.join()
    (OUT / "run_log.json").write_text(json.dumps(log, indent=1))
    print(json.dumps({k: v for k, v in log.items() if k == "fk"}, indent=1))
