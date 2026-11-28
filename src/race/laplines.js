// Where the fast drivers go round Toomemägi (Martin, 27 Nov 2026: "start logging trajectories (for darker asphalt
// area across racing line) and skid marks (for adding also skidmarks to main places) of faster players in toomemäe.
// log the top 5% from the lap record only. you dont even have to collect everything").
//
// Nothing new is written down while driving: every timed lap already keeps its drive for a replay
// (src/race/replay.js: place, heading, speed, steering, each axle's slide and rub, the ground, ten times a second of
// the lap clock: the same values the other players' screens lay this car's skid marks from). A lap whose time is
// within LINE_SHARE of its car's record on the board sends that drive, packed as a replay is (20 to 40 KB), once
// the server has the lap (src/net/multiplayer.js sendReplays). The server keeps it nameless beside the lap's id
// (worker/index.js, table lap_lines), at most LINES_MAX, and gives the rows back through GET /api/lines.
// Tallinn's Pirita-Kose lap (Martin 28 Nov 2026: "start loggin trajectory and skid marks of pirita track. log all the time
// as my test runs only currently"): every lap's drive goes to Tallinn's own lobby, kept or not (GET /api/lines?city=tallinn).
// The painted band and the lasting marks are made from them later; nothing in the game reads them yet.

export const LINE_TRACK = 'toomemagi';
export const LINE_SHARE = 1.05;            // a lap at most 5 % slower than its car's record
export const LINES_MAX = 4000;             // drives kept at most (35 to 40 KB each: about 150 MB); then the server says 410 and pages stop

// a lap of ms (its board time, penalty seconds in) is worth keeping, its car's record being best (ms), or none
export const lineWorth = (ms, best) => Number.isFinite(ms) && Number.isFinite(best) && best > 0 && ms <= best * LINE_SHARE;
