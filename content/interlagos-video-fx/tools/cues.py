"""Timeline of the Max x Interlagos video: every moment that gets a sound and/or a motion accent.

Times come from frame analysis of the original (onsets of each reveal), so effects land on the frame
where the graphic appears.
"""
FPS = 30
DURATION = 175.0

INTRO_ELEMENTS = [0.63, 5.07]                      # title in, position-trace graphic in
CUTS = [7.83, 47.83, 87.83, 127.83, 167.83]        # hard cuts: intro -> 2016 -> 2018 -> 2024 -> 2025 -> outro
CHAPTERS = [(7.83, 47.83), (47.83, 87.83), (87.83, 127.83), (127.83, 167.83)]
WIPE = 0.2                                          # each cut is a yellow wipe; the new chapter shows ~0.2 s later
REVEALS = [round(c + WIPE, 2) for c in CUTS]

# event rows (yellow highlight moves to a new row); the list fades at chapter start + 34.2 s
ROWS = [14.6, 19.03, 28.67, 32.03, 37.17,
        54.1, 57.07, 60.2, 64.87, 70.8,
        95.43, 98.07, 103.17, 108.8, 113.3,
        133.23, 137.7, 143.47, 151.57, 156.63]

# stat cards: three, staggered ~1/3 s apart, starting at chapter start + 34.2 s
CARD_STARTS = [42.03, 82.03, 122.03, 162.03]
CARD_STAGGER = [0.0, 0.33, 0.63]
CARDS = [round(s + d, 2) for s in CARD_STARTS for d in CARD_STAGGER]

# 2024 only: purple live counters (laps in a row as fastest car, race fastest lap broken) tick up
COUNTER_IN = [116.67]
COUNTER_TICKS = [116.87, 117.17, 117.47, 117.77, 118.07, 118.33, 118.93, 119.23, 119.53, 119.83, 120.13, 120.43, 121.0]

# outro summary: four tiles + call to action
OUTRO = [168.67, 169.47, 169.8, 170.43, 171.03]


def all_cues():
    cues = [(t, "intro") for t in INTRO_ELEMENTS]
    cues += [(t, "cut") for t in CUTS]
    cues += [(t, "row") for t in ROWS]
    cues += [(t, "card", i % 3) for i, t in enumerate(CARDS)]
    cues += [(t, "outro", i) for i, t in enumerate(OUTRO)]
    cues += [(t, "counter_in") for t in COUNTER_IN]
    cues += [(t, "tick", i) for i, t in enumerate(COUNTER_TICKS)]
    return sorted(cues, key=lambda c: c[0])
