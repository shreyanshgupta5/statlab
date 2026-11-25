# Cartoon driver portraits for the StatLab app

The app (v66+) shows a driver's cartoon portrait wherever it used to draw their helmet: stories, home "Following" cards,
driver pages, track previews, Play and the welcome guide. Drivers without a portrait keep their helmet, so portraits
can be added one at a time.

## Spec (same for every driver, so they match)
- **File:** `portraits/<ID>.png` in the app (IDs: RUS ANT LEC HAM VER HAD NOR PIA LIN LAW GAS COL BEA OCO BOR HUL ALB SAI STR ALO PER BOT TSU HIR CAM).
- **Size:** 512 × 512, square, head and shoulders centred, the face in the upper-middle third, about 15% space above the hair.
- **Background:** plain flat colour or transparent. The app draws the round crop and the team-colour ring.
- **No logos:** no sponsor logos, team badges or readable text on the suit or cap (trademarks). Plain team-colour race suit is fine.

## Style prompt (use the same one every time)
> Flat cel-shaded comic portrait of the person in the reference photo, head and shoulders, three-quarter view facing slightly right,
> bold clean black ink outlines, 3–4 flat tones per colour, subtle halftone dots in the shadows, warm friendly expression,
> plain race suit in <TEAM COLOURS> with no logos or text, plain flat <TEAM COLOUR> background, centred, square, 512×512.

Team colours used in the app (the ring colour): MER #27E0C2 · FER #E8102E · RBR #3B6FD8 · MCL #FF8A1F · RB #8C9BFF · ALP #FF6FB5 · HAA #B6BAC0 · AUD #C9D23A · WIL #4FA3FF · AMR #1FA67A · CAD #D4AF37.

## How to make them
1. **Reference photo:** use an openly licensed photo (CC BY / CC BY-SA, for example Wikimedia Commons paddock and fan-zone shots
   by Steffen Prößdorf or Liauzh), so the portrait can be published. Keep the photographer and licence.
2. **Generate:** with the Higgsfield skills (`higgsfield-generate`, image edit from a reference image; run `higgsfield auth login` first)
   or any image tool or illustrator, using the style prompt above. Generate 2–3 and keep the one that looks most like the driver
   and most like the others.
3. **Add to the app:** put the file in `portraits/` and add a line to `portraits.js`, for example
   `VER: { src: "portraits/VER.png", credit: "Illustration based on a photo by Steffen Prößdorf (CC BY-SA 4.0)" },`
   then bump the app version as usual.

Note: AI or hand-drawn likenesses of real drivers are fine for a fan project, but keep them respectful (no caricature that mocks),
and credit the source photo. If a driver or team objects, remove the portrait and the helmet comes back automatically.

## Tools in this folder
- `avatar.py`: real-photo round avatar with a print-dot texture (the alternative look).
- `cartoon.py`: the classic image-processing cartoon attempt (kept for reference; the results were not good enough).
- `fetch.py`: polite downloader for Openverse/Wikimedia candidates (Wikimedia rate-limits heavily).
