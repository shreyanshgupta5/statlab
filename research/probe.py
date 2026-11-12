"""Reachability probe: which public review sources answer a plain request from this runner."""
import re
import sys

import requests

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9",
           "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"}

TARGETS = [
    ("amazon_search", "https://www.amazon.in/s?k=1.5+ton+split+ac"),
    ("amazon_reviews", "https://www.amazon.in/product-reviews/B0BK1KS6ZD?sortBy=recent"),
    ("flipkart_search", "https://www.flipkart.com/search?q=1.5+ton+split+ac"),
    ("croma_search", "https://www.croma.com/searchB?q=split%20ac%3Arelevance"),
    ("reliance_search", "https://www.reliancedigital.in/products?q=split%20ac"),
    ("vijaysales_search", "https://www.vijaysales.com/search-listing?q=split%20ac"),
    ("voxya_list", "https://voxya.com/online-complaints/e-commerce-complaints"),
    ("voxya_item", "https://voxya.com/consumer-complaints/ac-installations-not-done/265551"),
    ("consumercomplaints_brand", "https://www.consumercomplaints.in/flipkart-b100293"),
    ("consumercomplaints_item", "https://www.consumercomplaints.in/flipkart-ac-installation-is-not-completed-c3541664"),
    ("mouthshut", "https://www.mouthshut.com/websites/Flipkart-com-reviews-925076191"),
    ("trustpilot", "https://www.trustpilot.com/review/www.flipkart.com"),
    ("reddit_json", "https://www.reddit.com/search.json?q=flipkart+AC+installation&sort=new&t=year&limit=5"),
    ("techenclave", "https://techenclave.com/t/flipkart-feedback-thread/194222"),
    ("desidime", "https://www.desidime.com/discussions/i-ordered-ac-from-flipkart-reveived-damaged"),
]
BLOCK = re.compile(r"captcha|robot check|access denied|are you a human|unusual traffic|"
                   r"cf-challenge|just a moment|recaptcha", re.I)

for name, url in TARGETS:
    try:
        r = requests.get(url, headers=HEADERS, timeout=25)
        text = r.text
        title = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
        title = re.sub(r"\s+", " ", title.group(1)).strip()[:70] if title else ""
        flag = "BLOCK-MARKER" if BLOCK.search(text[:20000]) else "ok"
        print(f"{name:26s} {r.status_code} len={len(text):8d} {flag:12s} | {title}")
    except Exception as e:  # noqa: BLE001
        print(f"{name:26s} ERROR {type(e).__name__}: {str(e)[:90]}")

try:
    from google_play_scraper import Sort, reviews
    res, _ = reviews("com.flipkart.android", lang="en", country="in", sort=Sort.NEWEST, count=5)
    print(f"{'google_play':26s} ok reviews={len(res)} newest={res[0]['at'] if res else None}")
except Exception as e:  # noqa: BLE001
    print(f"{'google_play':26s} ERROR {type(e).__name__}: {str(e)[:90]}")
sys.exit(0)
