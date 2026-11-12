"""Try reading public Amazon.in product-page reviews with a real browser. Stops if a CAPTCHA appears."""
import csv
import json
import pathlib
import random
import re
import time

from playwright.sync_api import sync_playwright

OUT = pathlib.Path("out")
(OUT / "html").mkdir(parents=True, exist_ok=True)
QUERIES = [("ac", "1.5 ton split ac", 10), ("refrigerator", "double door refrigerator", 10),
           ("washing_machine", "fully automatic washing machine", 10),
           ("tv", "55 inch smart tv", 10), ("dishwasher", "dishwasher", 6),
           ("air_cooler", "air cooler", 6)]
CAPTCHA = re.compile(r"Enter the characters you see below|api-services-support@amazon|"
                     r"Type the characters|validateCaptcha|Click the button below to continue shopping", re.I)
log = {"search": {}, "products": 0, "product_ok": 0, "reviews": 0, "blocked": 0, "notes": []}
START = time.time()


def pause():
    time.sleep(random.uniform(2.5, 4.5))


with sync_playwright() as p, open(OUT / "amazon_reviews.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["category", "asin", "product", "stars", "date", "title", "text", "verified", "helpful"])
    browser = p.chromium.launch()
    ctx = browser.new_context(locale="en-IN", timezone_id="Asia/Kolkata",
                              viewport={"width": 1366, "height": 900})
    page = ctx.new_page()

    def load(url, name=None):
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
            html = page.content()
            status = resp.status if resp else 0
        except Exception as e:  # noqa: BLE001
            log["notes"].append(f"{type(e).__name__} {url[:70]}")
            return 0, ""
        if name:
            (OUT / "html" / f"{name}.html").write_text(html, encoding="utf-8")
        if CAPTCHA.search(html) and len(html) < 20000:
            log["blocked"] += 1
            return status, ""
        return status, html

    status, html = load("https://www.amazon.in/", "amazon_home")
    log["home"] = [status, len(html)]
    pause()
    for cat, query, n in QUERIES:
        if log["blocked"] >= 3 or time.time() - START > 20 * 60:
            break
        status, html = load("https://www.amazon.in/s?k=" + query.replace(" ", "+"),
                            f"amazon_search_{cat}")
        asins = []
        for a in page.eval_on_selector_all(
                "div[data-component-type='s-search-result'][data-asin]",
                "els => els.map(e => e.getAttribute('data-asin'))") if html else []:
            if a and a not in asins:
                asins.append(a)
        log["search"][cat] = [status, len(html), len(asins)]
        pause()
        for i, asin in enumerate(asins[:n]):
            if log["blocked"] >= 3 or time.time() - START > 20 * 60:
                break
            log["products"] += 1
            status, html = load(f"https://www.amazon.in/dp/{asin}",
                                f"amazon_dp_{cat}" if i == 0 else None)
            if not html:
                pause()
                continue
            log["product_ok"] += 1
            try:
                title = (page.text_content("#productTitle") or "").strip()[:120]
                revs = page.eval_on_selector_all("[data-hook='review']", """els => els.map(e => {
                    const t = s => { const x = e.querySelector(s); return x ? x.textContent.trim() : ''; };
                    return [t("[data-hook$='review-star-rating']"), t("[data-hook='review-date']"),
                            t("[data-hook='review-title']"), t("[data-hook='review-body']"),
                            t("[data-hook='avp-badge']"), t("[data-hook='helpful-vote-statement']")];
                })""")
            except Exception as e:  # noqa: BLE001
                log["notes"].append(f"parse {type(e).__name__} {asin}")
                revs, title = [], ""
            for r in revs:
                stars = re.match(r"([\d.]+)", r[0] or "")
                w.writerow([cat, asin, title, stars.group(1) if stars else "", r[1],
                            re.sub(r"^[\d.]+ out of 5 stars\s*", "", r[2]),
                            re.sub(r"\s+", " ", r[3]).replace("Read more", "").strip(), bool(r[4]), r[5]])
            log["reviews"] += len(revs)
            f.flush()
            pause()
    # one attempt at the full review listing, to record whether it needs a sign-in
    status, html = load("https://www.amazon.in/product-reviews/" +
                        (asins[0] if asins else "B0BK1KS6ZD") + "?sortBy=recent", "amazon_reviews_page")
    log["reviews_page"] = [status, len(html), "signin" in page.url]
    browser.close()

(OUT / "amazon_log.json").write_text(json.dumps(log, indent=1))
print(json.dumps(log, indent=1))
