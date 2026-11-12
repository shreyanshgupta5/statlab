"""Collect public, dated app-store reviews about large appliances, plus raw page samples
used to build parsers for retail and complaint sites. Low volume, public pages only."""
import csv
import datetime as dt
import json
import pathlib
import re
import time

import requests
from google_play_scraper import Sort, reviews, search

OUT = pathlib.Path("out")
(OUT / "html").mkdir(parents=True, exist_ok=True)
SINCE = dt.datetime.now() - dt.timedelta(days=185)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9"}
KEYWORDS = re.compile(
    r"\b(a\.?c|air ?conditioner|fridge|refrigerator|washing ?machine|dish ?washer|tv|television|"
    r"cooler|install\w*|technician|jeeves|appliance\w*|exchange)\b", re.I)

APPS = {  # label -> (search term, expected word in title, max reviews to scan)
    "flipkart": ("Flipkart Online Shopping App", "flipkart", 60000),
    "amazon": ("Amazon India Shop", "amazon", 60000),
    "croma": ("Croma", "croma", 20000),
    "reliance_digital": ("Reliance Digital", "reliance digital", 20000),
    "vijay_sales": ("Vijay Sales", "vijay sales", 20000),
    "jeeves": ("Jeeves Flipkart service", "jeeves", 20000),
}
FALLBACK = {"flipkart": "com.flipkart.android", "amazon": "in.amazon.mShop.android.shopping"}


def resolve(label, term, word):
    try:
        for hit in search(term, lang="en", country="in", n_hits=8):
            if word in hit["title"].lower() and hit.get("appId"):
                return hit["appId"], hit["title"]
    except Exception as e:  # noqa: BLE001
        print("search failed", label, type(e).__name__, e)
    return FALLBACK.get(label), "fallback"


def collect_play():
    rows, coverage = [], {}
    for label, (term, word, cap) in APPS.items():
        app_id, title = resolve(label, term, word)
        if not app_id:
            coverage[label] = {"error": "app not found"}
            continue
        token, scanned, oldest, kept = None, 0, None, 0
        try:
            while scanned < cap:
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
                        rows.append([label, app_id, r["at"].date().isoformat(), r["score"],
                                     r.get("thumbsUpCount", 0), text.replace("\n", " ").strip()])
                if oldest < SINCE or token is None or getattr(token, "token", None) is None:
                    break
                time.sleep(0.4)
        except Exception as e:  # noqa: BLE001
            coverage.setdefault(label, {})["error"] = f"{type(e).__name__}: {e}"[:200]
        coverage.setdefault(label, {}).update(
            app_id=app_id, title=title, scanned=scanned, kept=kept,
            oldest_scanned=oldest.isoformat() if oldest else None)
        print(label, coverage[label])
    with open(OUT / "play_reviews.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["platform", "app_id", "date", "stars", "thumbs_up", "text"])
        w.writerows(rows)
    (OUT / "play_coverage.json").write_text(json.dumps(coverage, indent=1))


def save(name, url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        (OUT / "html" / f"{name}.html").write_text(r.text, encoding="utf-8")
        print(f"{name:32s} {r.status_code} {len(r.text)}")
        return r.text if r.status_code == 200 else ""
    except Exception as e:  # noqa: BLE001
        print(f"{name:32s} ERROR {type(e).__name__}")
        return ""
    finally:
        time.sleep(2)


def collect_samples():
    html = save("flipkart_search_ac", "https://www.flipkart.com/search?q=1.5+ton+split+ac")
    save("flipkart_search_fridge", "https://www.flipkart.com/search?q=double+door+refrigerator")
    links = list(dict.fromkeys(re.findall(r'href="(/[^"]+/p/itm[^"]+)"', html)))[:2]
    for i, link in enumerate(links):
        link = link.replace("&amp;", "&")
        save(f"flipkart_product_{i}", "https://www.flipkart.com" + link)
        rev = link.replace("/p/", "/product-reviews/", 1)
        sep = "&" if "?" in rev else "?"
        save(f"flipkart_reviews_{i}", "https://www.flipkart.com" + rev + sep + "sortOrder=MOST_RECENT")
        save(f"flipkart_reviews_{i}_neg", "https://www.flipkart.com" + rev + sep + "sortOrder=NEGATIVE_FIRST")
    save("croma_search", "https://www.croma.com/searchB?q=split%20ac%3Arelevance")
    save("vijaysales_search", "https://www.vijaysales.com/search-listing?q=split%20ac")
    save("cc_home", "https://www.consumercomplaints.in/")
    save("cc_item", "https://www.consumercomplaints.in/flipkart-ac-installation-is-not-completed-c3541664")
    save("cc_search", "https://www.consumercomplaints.in/?search=flipkart+ac+installation")
    save("cc_bysubcategory", "https://www.consumercomplaints.in/bysubcategory/online-shopping/1.html")
    save("desidime_item", "https://www.desidime.com/discussions/i-ordered-ac-from-flipkart-reveived-damaged")


if __name__ == "__main__":
    collect_play()
    collect_samples()
