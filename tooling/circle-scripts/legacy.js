'use strict';

// circle kills builds when stdout stops seeing bytes for 10 minutes; the legacy
// suite exceeds circle's buffer limit. legacy.sh runs the legacy test suite and
// writes its output to a file in CIRCLE_ARTIFACTS and legacy.js runs that file
// while writing periods to STDOUT

const cp = require(`child_process`);

let timer;
function tick() {
  timer = setTimeout(() => {
    console.log(`.`);
    tick();
  }, 15000);
}

tick();
// spawn's arguments array is a little tricky to manage, so it it seemed easier
// to just put the logic in a shell script and rely on this file for ticks.
const legacy = cp.spawn(`legacy.sh`, [], {
  stdio: [`pipe`, `pipe`, `pipe`]
});

legacy.on(`close`, () => clearTimeout(timer));
