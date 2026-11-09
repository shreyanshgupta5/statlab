# Assembles the points-race page: template + script + data -> points-race.html (published) and a local test copy.
t = open('points-race.template.html').read(); js = open('points-race.js').read(); d = open('race-data.json').read()
js = js.replace('/* __AUDIO__ */', open('race-audio.js').read())
page = t.replace('__SCRIPT__', js.replace('__DATA__', d))
open('points-race.html', 'w').write(page)
open('points-race.local.html', 'w').write('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + page)
print('built', len(page), 'bytes')
