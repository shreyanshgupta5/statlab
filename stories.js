// Hand-written "burning" stories for the home page row, newest first. Automatic stories (latest session, standings,
// next race, news) are built in app.js from the season data; these sit right after the latest-session story.
// Each: id (change it to make the story show as unseen again), date (YYYY-MM-DD), label (under the circle),
// cover: {helmet: "ANT"} or {text: "0.03"}, color (ring/slide accent), slides: [{kicker, title, text, stat, statLabel, helmet, link, linkText}].
window.STORIES = [
  {
    id: "vegas-under-one-second", date: "2026-11-23", label: "1 second", cover: { text: "<1s" }, color: "#E10600",
    slides: [
      { kicker: "Las Vegas GP · the gap", title: "Never more than a second apart", stat: "43/43", statLabel: "green-flag laps with P1 and P2 under 1 second" },
      { kicker: "Las Vegas GP · the gap", title: "The closest it got", stat: "0.030s", statLabel: "Verstappen's lead at the end of lap 8" },
      { kicker: "Why so close?", title: "A cold track, low tyre wear and long straights", text: "14°C on the track, almost no degradation, and one of the longest flat-out laps of the year kept the leaders glued together.", link: "#/race/21", linkText: "Open race analysis" },
    ],
  },
  {
    id: "antonelli-battery-vegas", date: "2026-11-23", label: "Antonelli", cover: { helmet: "ANT" }, color: "#27E0C2",
    slides: [
      { kicker: "Las Vegas GP · final lap", title: "P2 to P4 on the last straight", helmet: "ANT", text: "Antonelli was second starting the final lap. Norris and Piastri both passed him before Turn 1." },
      { kicker: "The telemetry", title: "Flat out, and still slower", stat: "−36 km/h", statLabel: "Antonelli's top speed against Piastri's, both at full throttle (OpenF1)" },
      { kicker: "In his words", title: "“Probably it was a mistake on my side.”", text: "He lifted early to keep Overtake Mode, then ran out of electric power out of the chicane.", link: "#/race/21", linkText: "See the race" },
    ],
  },
];
