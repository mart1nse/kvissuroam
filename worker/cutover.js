// Pages opened before 26 Nov 2026's deploy do not yet send what the server asks for since then (a racer's positions
// while nobody else is online, the marks of a lap's start and finish). Nothing tells such a page to reload, so
// until this moment (28 Nov, 00:00 in Tartu) what they cannot send is not asked of anyone; after it, it is.
export const OLD_PAGES_UNTIL = Date.UTC(2026, 10, 27, 22, 0, 0);
// The same for a car's places while it is on a lap alone (asked of a record since 26 Nov 2026, worker/livecheck.js:
// pages opened before that send them only with somebody else online): until 29 Nov, 00:00 in Tartu, a record the
// car was not seen driving is taken as before.
export const LIVE_FROM = Date.UTC(2026, 10, 28, 22, 0, 0);
