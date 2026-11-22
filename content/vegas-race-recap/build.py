# reel.template.html + stills.js + reel-data.json -> reel.html (storyboard stills; ?scene=...)
t = open("reel.template.html").read(); js = open("stills.js").read(); d = open("reel-data.json").read()
open("reel.html", "w").write(t.replace("__SCRIPT__", js.replace("__DATA__", d)))
print("built reel.html")
