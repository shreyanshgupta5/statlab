"""Furniture study, step 1: which sources answer from this runner, and what their pages look like."""
import json
import pathlib
import re
import time

import requests
from google_play_scraper import search
from playwright.sync_api import sync_playwright

OUT = pathlib.Path("out/html")
OUT.mkdir(parents=True, exist_ok=True)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9"})
BLOCK = re.compile(r"captcha|access denied|are you a human|just a moment|attention required|verifying", re.I)
log = {}


def save(name, url):
    try:
        r = S.get(url, timeout=30)
        (OUT / f"{name}.html").write_text(r.text, encoding="utf-8")
        t = re.search(r"<title[^>]*>(.*?)</title>", r.text, re.S | re.I)
        log[name] = [r.status_code, len(r.text), bool(BLOCK.search(r.text[:20000])),
                     re.sub(r"\s+", " ", t.group(1)).strip()[:70] if t else ""]
    except Exception as e:  # noqa: BLE001
        log[name] = ["ERR", type(e).__name__]
    print(name, log[name], flush=True)
    time.sleep(2)


TARGETS = [
    ("fk_sofa", "https://www.flipkart.com/search?q=3+seater+sofa"),
    ("fk_bed", "https://www.flipkart.com/search?q=king+size+bed+with+storage"),
    ("fk_chair", "https://www.flipkart.com/search?q=office+chair"),
    ("pf_search", "https://www.pepperfry.com/site_product/search?q=3+seater+sofa"),
    ("pf_home", "https://www.pepperfry.com/"),
    ("ul_search", "https://www.urbanladder.com/products/search?keywords=sofa"),
    ("ul_home", "https://www.urbanladder.com/"),
    ("ikea_search", "https://www.ikea.com/in/en/search/?q=sofa"),
    ("ikea_cat", "https://www.ikea.com/in/en/cat/sofas-fu003/"),
    ("wakefit_home", "https://www.wakefit.co/"),
    ("wakefit_sofa", "https://www.wakefit.co/sofa/"),
    ("godrej_home", "https://www.godrejinterio.com/"),
    ("homecentre_home", "https://www.homecentre.in/in/en"),
    ("cc_pepperfry", "https://www.consumercomplaints.in/?search=pepperfry"),
    ("cc_urbanladder", "https://www.consumercomplaints.in/?search=urban+ladder"),
    ("cc_wakefit", "https://www.consumercomplaints.in/?search=wakefit"),
    ("cc_ikea", "https://www.consumercomplaints.in/?search=ikea"),
    ("dd_sofa", "https://www.desidime.com/selective_search?date_range=all_time&keyword=sofa&search_list=discussions&search_terms=title%2Cdescription%2Ccomments&sort_type=new"),
]
for name, url in TARGETS:
    save(name, url)

# Flipkart: one product page and its reviews, to confirm the appliance parser works for furniture
html = (OUT / "fk_sofa.html").read_text(encoding="utf-8") if (OUT / "fk_sofa.html").exists() else ""
m = re.search(r'href="(/[^"]+/p/(itm[0-9a-z]+)\?[^"]*pid=([A-Z0-9]+)[^"]*)"', html)
if m:
    slug = m.group(1).split("/p/")[0].strip("/")
    save("fk_sofa_reviews", f"https://www.flipkart.com/{slug}/product-reviews/{m.group(2)}?pid={m.group(3)}&sortOrder=MOST_RECENT")

# Rendered pages for sites that build their pages in the browser
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(user_agent=UA, locale="en-IN")
    for name, url in [("pf_search_r", "https://www.pepperfry.com/site_product/search?q=3+seater+sofa"),
                      ("ul_search_r", "https://www.urbanladder.com/products/search?keywords=sofa"),
                      ("ikea_cat_r", "https://www.ikea.com/in/en/cat/sofas-fu003/"),
                      ("wakefit_sofa_r", "https://www.wakefit.co/sofa/")]:
        try:
            pg.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                pg.wait_for_load_state("networkidle", timeout=10000)
            except Exception:  # noqa: BLE001
                pass
            h = pg.content()
            (OUT / f"{name}.html").write_text(h, encoding="utf-8")
            log[name] = ["rendered", len(h), bool(BLOCK.search(h[:20000])), pg.title()[:70]]
        except Exception as e:  # noqa: BLE001
            log[name] = ["ERR", type(e).__name__]
        print(name, log[name], flush=True)
        time.sleep(2)
    b.close()

apps = {}
for term in ["Pepperfry", "Urban Ladder", "IKEA India", "Wakefit", "Godrej Interio", "Home Centre"]:
    try:
        apps[term] = [(h.get("appId"), h.get("title")) for h in search(term, lang="en", country="in", n_hits=5)]
    except Exception as e:  # noqa: BLE001
        apps[term] = str(e)[:80]
log["play_search"] = apps
(OUT.parent / "probe_log.json").write_text(json.dumps(log, indent=1))
print(json.dumps(apps, indent=1))
