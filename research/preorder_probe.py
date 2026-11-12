"""Save sample pages for buyer questions (Flipkart) and advice threads (Desidime) so parsers can be built."""
import pathlib
import re
import time

import requests

OUT = pathlib.Path("out/html")
OUT.mkdir(parents=True, exist_ok=True)
S = requests.Session()
S.headers.update({"User-Agent": ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
                                 "Chrome/126.0 Safari/537.36"), "Accept-Language": "en-IN,en;q=0.9"})


def save(name, url):
    try:
        r = S.get(url, timeout=30)
        (OUT / f"{name}.html").write_text(r.text, encoding="utf-8")
        print(f"{name:28s} {r.status_code} {len(r.text):8d} {r.url[:90]}")
        return r.text if r.status_code == 200 else ""
    except Exception as e:  # noqa: BLE001
        print(f"{name:28s} ERROR {type(e).__name__}")
        return ""
    finally:
        time.sleep(2)


html = save("fk_search", "https://www.flipkart.com/search?q=1.5+ton+split+ac")
n = 0
for link, item in re.findall(r'href="(/[^"]+/p/(itm[0-9a-z]+)\?[^"]*)"', html):
    pid = re.search(r"pid=([A-Z0-9]+)", link)
    if not pid:
        continue
    slug = link.split("/p/")[0].strip("/")
    base = f"https://www.flipkart.com/{slug}/product-questions/{item}?pid={pid.group(1)}"
    save(f"fk_questions_{n}_p1", base)
    save(f"fk_questions_{n}_p2", base + "&page=2")
    n += 1
    if n == 2:
        break

D = "https://www.desidime.com"
for name, path in [
    ("dd_search_topics", "/selective_search?keyword=air+conditioner&search_list=topics"),
    ("dd_search_discussions", "/selective_search?keyword=air+conditioner&search_list=discussions"),
    ("dd_search_deals", "/selective_search?keyword=air+conditioner&search_list=deals"),
    ("dd_search_plain", "/search?q=air+conditioner"),
    ("dd_groups", "/groups"),
    ("dd_discussions", "/discussions"),
    ("dd_discussions_p2", "/discussions?page=2"),
    ("dd_forum", "/forums/dost-and-dimes"),
    ("dd_thread", "/discussions/i-ordered-ac-from-flipkart-reveived-damaged"),
]:
    save(name, D + path)
