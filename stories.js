// Hand-written "burning" stories for the home page row. The row is sorted newest first across ALL stories
// (these, plus the automatic latest-session, standings, next-race and news stories built in app.js).
// Each: id (change it to make the story show as unseen again), date ("YYYY-MM-DD" or a full ISO time, used for the order),
// label (headline under the circle, 2 lines max, ~26 characters), color (ring/slide accent),
// cover: {helmet: "ANT", hook: "−36"}, {chart: "gap", race: 21, text: "<1s"}, {text: "FIA", hook: "2027", bg: "#..."}, {img},
// round: N (a preview of that round: replaces the automatic "next race" story),
// news: ["id-prefix", …] (news items this story already covers: they get no story of their own),
// slides: [{kicker, title, text, stat, statLabel, helmet, small, img, rows: [[n, "ID", "value"]], countdown: ISO,
//           chart: {type: "gap", race, mark, caption}, link, linkText}].
// Top-story themes: the next Grand Prix, driver contracts, rule announcements, midweek fallout from the last race.
window.STORIES = [
  {
    id: "qatar-preview-2026-v3", date: "2026-11-26T18:00:00Z", round: 22, label: "Qatar GP: what to watch", cover: { text: "🇶🇦", hook: "3D" }, color: "#C8102E",
    news: ["verstappen-heads-to-qatar", "qatar-preview-27-lap", "alonso-sits-out-qatar", "titles-settled-but-hamilton"],
    slides: [
      { kicker: "Round 22 of 23 · Lusail · this weekend", title: "Qatar Grand Prix", countdown: "2026-11-29T16:00:00Z", text: "57 laps under the lights. Practice Friday, qualifying Saturday, lights out Sunday at 16:00 GMT (19:00 in Qatar). No sprint this time." },
      { kicker: "The favourite", title: "Lusail belongs to Verstappen", helmet: "VER", stat: "3", statLabel: "Qatar wins in a row: 2023, 2024, 2025", text: "He arrives off the Las Vegas win and is the bookmakers' pick. Antonelli, Norris and Russell are next in the betting." },
      { kicker: "How Qatar is won", title: "A safety car every year", stat: "3/3", statLabel: "of the last three races here had at least one", text: "In 2025 it came out on lap 7. Verstappen pitted under it and won from third, while Piastri, on pole, stayed out and finished second. In 2024 Verstappen's only stop also came under a safety car." },
      { kicker: "Form · last 5 races", title: "Nobody is hotter", rows: [[1, "VER", "108"], [2, "ANT", "77"], [3, "NOR", "75"]], text: "Points from the last five Grands Prix: Verstappen has three wins and nothing worse than third." },
      { kicker: "The fight for second", title: "Leave Qatar 26 clear and P2 is his", rows: [[2, "VER", "304"], [3, "HAM", "267"]], stat: "37", statLabel: "points ahead of Hamilton, with 50 left" },
      { kicker: "The fight for third", title: "Three drivers, three points", rows: [[3, "HAM", "267"], [4, "RUS", "264"], [5, "NOR", "264"]], text: "Both titles are settled. This is what Qatar and Abu Dhabi still decide." },
      { kicker: "Constructors · third place", title: "Red Bull vs McLaren", stat: "9", statLabel: "points between them: Red Bull 440, McLaren 431" },
      { kicker: "Tyres", title: "A two-stop race", stat: "27", statLabel: "laps max on any set of tyres, in a 57-lap race (reported by race previews)", text: "Lusail's fast, long corners punish the left-front. A cap per set forces at least two stops, so pit timing and safety cars decide a lot." },
      { kicker: "Friday line-up", title: "Alonso sits out FP1", helmet: "ALO", small: true, text: "Aston Martin reserve Jak Crawford drives his car in first practice, as he did in Las Vegas, where rain left him with little more than an installation lap.", link: "#/race/22", linkText: "Full analysis" },
    ],
  },
  {
    id: "bearman-haas-2027", date: "2026-11-26T14:00:00Z", news: ["haas-confirm-bearman"], label: "Bearman stays for 2027", cover: { helmet: "BEA", hook: "2027" }, color: "#B6BAC0",
    slides: [
      { kicker: "Contracts · confirmed 26 Nov", title: "Bearman signs for 2027", helmet: "BEA", text: "Haas confirmed him on Thursday, ahead of Qatar, ending a wait that dragged on all season. Team boss Ayao Komatsu called it a “natural decision”." },
      { kicker: "Why it took so long", title: "Ferrari had to say yes", text: "Bearman is a Ferrari driver on loan, so Ferrari had to approve the deal. He was openly frustrated about the delay in Las Vegas. Even now he says a Ferrari race seat is still the goal, and that Haas has “unfinished business”." },
      { kicker: "His team-mate", title: "Câmara replaces Ocon", rows: [[87, "BEA", "2027"], [51, "CAM", "2027+"]], text: "Rafael Câmara, another Ferrari junior, takes Esteban Ocon's seat full time. Haas is the only team changing its line-up." },
      { kicker: "Silly season is over", title: "The 2027 grid is complete", stat: "22/22", statLabel: "seats confirmed for 2027", link: "#/driver/BEA", linkText: "Bearman's season" },
    ],
  },
  {
    id: "cost-cap-2025-verdicts", date: "2026-11-25T16:00:00Z", label: "Williams & Alpine fined", cover: { text: "£627k", bg: "#4FA3FF" }, color: "#4FA3FF",
    news: ["williams-and-alpine-breached"],
    slides: [
      { kicker: "Rules · FIA cost cap · 2025 accounts", title: "Two teams in breach", text: "The FIA's review of the 2025 budgets found Williams overspent and Alpine filed inaccurate reports. Both teams accepted the findings (an Accepted Breach Agreement), so there is no hearing." },
      { kicker: "Williams", title: "A small overspend", stat: "£627k", statLabel: "over the cap, about 0.48%", text: "Williams says it came from admin costs when it changed its company structure, which it believed sat outside the cap. The FIA says it acted in good faith." },
      { kicker: "Williams · the penalty", title: "Less wind tunnel time", stat: "−1.5%", statLabel: "wind tunnel and CFD testing for 12 months, plus a fine", text: "Small, but it lands while the team develops its 2027 car." },
      { kicker: "Alpine", title: "A paperwork breach", text: "Alpine's spending was under the cap. Its breach was procedural (errors in what it reported). It pays a fine and the investigation costs by 12 December, with no sporting penalty.", link: "#/news", linkText: "All news" },
    ],
  },
  {
    id: "hadjar-wing-vegas", date: "2026-11-25T12:00:00Z", news: ["hadjar-s-front-wing", "hadjar-penalised"], label: "Hadjar's wing “exploded”", cover: { helmet: "HAD", hook: "P3→15" }, color: "#3B6FD8",
    slides: [
      { kicker: "Las Vegas fallout · Red Bull", title: "A podium that fell apart", helmet: "HAD", stat: "P3 → P15", statLabel: "fourth on the grid, a podium place at half-distance, then out of the points" },
      { kicker: "What happened", title: "The wing collapsed at Turn 5", text: "Running third after the safety-car restart, Hadjar's front wing gave way on the approach to Turn 5. He thinks it failed as the wing switched back to its closed position just as he hit a bump." },
      { kicker: "Red Bull's verdict", title: "“Most likely on us”", text: "Laurent Mekies took the blame for the team. Red Bull has not fully explained it yet and is strengthening the front wing for Qatar." },
      { kicker: "And then a penalty", title: "Slowing behind the safety car", text: "The stewards also found he deliberately backed up the field so Red Bull could double-stack its pit stops. “It's just ruining my motivation to drive,” Hadjar said.", link: "#/race/21", linkText: "Race analysis" },
    ],
  },
  {
    id: "ferrari-vegas-clash", date: "2026-11-24T12:00:00Z", label: "Ferrari's team-mate crash", cover: { helmet: "LEC", hook: "+10s" }, color: "#E8102E",
    news: ["vasseur-blames-leclerc", "leclerc-embarrassed"],
    slides: [
      { kicker: "Las Vegas fallout · Ferrari", title: "Lap 38, Turn 7", text: "Fighting for sixth, Leclerc dived up the inside of Hamilton and they touched. Hamilton spun and dropped from sixth to tenth." },
      { kicker: "The stewards", title: "Leclerc to blame", rows: [[7, "HAM", "spun"], [10, "LEC", "+10s"]], text: "Leclerc got a 10-second penalty and finished tenth. Hamilton recovered to seventh, despite his own 10 seconds for passing Norris off the track." },
      { kicker: "On the radio", title: "“I want to see you after the race”", helmet: "LEC", small: true, text: "Fred Vasseur called the move “completely unacceptable” and backed the stewards. Leclerc said he was embarrassed for the team and did not contest the penalty." },
      { kicker: "What changes in Qatar", title: "No team orders, for now", text: "Vasseur still won't impose orders. He says it's about professionalism, and that Ferrari will “respond as a team” in Qatar. Ferrari is second in the constructors' championship.", link: "#/race/21", linkText: "Race analysis" },
    ],
  },
  {
    id: "fia-permanent-stewards-2027", date: "2026-11-20T12:00:00Z", news: ["fia-to-hire-full-time"], label: "Full-time F1 stewards from 2027", cover: { text: "FIA", hook: "2027", bg: "#1F3C88" }, color: "#4FA3FF",
    slides: [
      { kicker: "Rules · announced 20 Nov", title: "Full-time stewards are coming", text: "The FIA will hire its first full-time F1 stewards during 2027, aiming for more consistent decisions from race to race." },
      { kicker: "How big", title: "A department of 12 to 15", stat: "12–15", statLabel: "full-time stewards in the long run, starting small in 2027 and growing from 2028" },
      { kicker: "What stays", title: "Driver stewards keep their seat", text: "Today's part-time stewards and the ex-driver stewards stay. The new team links up with the FIA's Remote Operations Centre in Biggin Hill. The number of stewards at each race is not changing for now." },
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
    news: ["antonelli-explains-the-battery"],
    slides: [
      { kicker: "Las Vegas GP · final lap", title: "P2 to P4 on the last straight", helmet: "ANT", text: "Antonelli was second starting the final lap. Norris and Piastri both passed him before Turn 1." },
      { kicker: "The telemetry", title: "Flat out, and still slower", stat: "−36 km/h", statLabel: "Antonelli's top speed against Piastri's, both at full throttle (OpenF1)" },
      { kicker: "In his words", title: "“Probably it was a mistake on my side.”", text: "He lifted early to keep Overtake Mode, then ran out of electric power out of the chicane.", link: "#/race/21", linkText: "See the race" },
    ],
  },
];
