// Hand-written "burning" stories for the home page row, newest first. Automatic stories (latest session, standings,
// next race, news) are built in app.js from the season data; these sit right after the latest-session story.
// Each: id (change it to make the story show as unseen again), date (YYYY-MM-DD), label (headline under the circle, 2 lines max, ~26 characters),
// cover: {helmet: "ANT", hook: "−36"}, {chart: "gap", race: 21, text: "<1s"}, {img} or {text: "0.03"}, color (ring/slide accent), slides: [{kicker, title, text, stat, statLabel, helmet, img, chart: {type: "gap", race, mark, caption}, link, linkText}].
window.STORIES = [
  {
    id: "qatar-preview-2026", date: "2026-11-26", label: "Qatar preview: Max's track", cover: { helmet: "VER", hook: "3 wins" }, color: "#C8102E",
    slides: [
      { kicker: "Qatar GP · this weekend", title: "Lusail belongs to Verstappen", helmet: "VER", stat: "3", statLabel: "Qatar wins in a row: 2023, 2024, 2025" },
      { kicker: "The fight for second", title: "Leave Qatar 26 clear and P2 is his", rows: [[2, "VER", "304"], [3, "HAM", "267"]], stat: "37", statLabel: "points ahead of Hamilton, with 50 left" },
      { kicker: "The fight for third", title: "Three drivers, three points", rows: [[3, "HAM", "267"], [4, "RUS", "264"], [5, "NOR", "264"]] },
      { kicker: "Constructors · third place", title: "Red Bull vs McLaren", stat: "9", statLabel: "points between them: Red Bull 440, McLaren 431" },
      { kicker: "Tyres", title: "A two-stop race", stat: "27", statLabel: "laps max on any set of tyres, in a 57-lap race (Pirelli)", link: "#/race/22", linkText: "Weekend preview" },
    ],
  },
  {
    id: "vegas-under-one-second", date: "2026-11-23", label: "Never 1 second apart", cover: { chart: "gap", race: 21, text: "<1s" }, color: "#E10600",
    slides: [
      { kicker: "Las Vegas GP · the gap", title: "Never more than a second apart", stat: "43/43", statLabel: "green-flag laps with P1 and P2 under 1 second", chart: { type: "gap", race: 21 } },
      { kicker: "Las Vegas GP · the gap", title: "The closest it got", stat: "0.030s", statLabel: "Verstappen's lead at the end of lap 8", chart: { type: "gap", race: 21, mark: 8, caption: "Lap 8 · 0.030s" } },
      { kicker: "Why so close?", title: "A cold track, low tyre wear and long straights", text: "14°C on the track, almost no degradation, and one of the longest flat-out laps of the year kept the leaders glued together.", link: "#/race/21", linkText: "Open race analysis" },
    ],
  },
  {
    id: "antonelli-battery-vegas", date: "2026-11-23", label: "How Antonelli lost P2", cover: { helmet: "ANT", hook: "−36" }, color: "#27E0C2",
    slides: [
      { kicker: "Las Vegas GP · final lap", title: "P2 to P4 on the last straight", helmet: "ANT", text: "Antonelli was second starting the final lap. Norris and Piastri both passed him before Turn 1." },
      { kicker: "The telemetry", title: "Flat out, and still slower", stat: "−36 km/h", statLabel: "Antonelli's top speed against Piastri's, both at full throttle (OpenF1)" },
      { kicker: "In his words", title: "“Probably it was a mistake on my side.”", text: "He lifted early to keep Overtake Mode, then ran out of electric power out of the chicane.", link: "#/race/21", linkText: "See the race" },
    ],
  },
];
