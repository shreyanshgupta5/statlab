# reel.template.html + stills.js + reel-data.json -> reel.html (storyboard stills; ?scene=...)
t = open("reel.template.html").read(); js = open("stills.js").read(); d = open("reel-data.json").read()
open("reel.html", "w").write(t.replace("__SCRIPT__", js.replace("__DATA__", d)))
print("built reel.html")

# story.html + track.json -> story.built.html (photo-led story frames; ?f=1..8)
s = open("story.html").read().replace("__TRACK__", open("track.json").read())
open("story.built.html", "w").write(s); print("built story.built.html")
