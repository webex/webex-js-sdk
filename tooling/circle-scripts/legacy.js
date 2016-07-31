'use strict';

// circle kills builds when stdout stops seeing bytes for 10 minutes; the legacy
// suite exceeds circle's buffer limit. legacy.sh runs the legacy test suite and
// writes its output to a file in CIRCLE_ARTIFACTS and legacy.js runs that file
// while writing periods to STDOUT

const cp = require(`child_process`);
const path = require(`path`);
let timer;
function tick() {
  process.stdout.write(`.`);
  timer = setTimeout(() => {
    tick();
  }, 5000);
}

try {
  tick();
  // spawn's arguments array is a little tricky to manage, so it it seemed easier
  // to just put the logic in a shell script and rely on this file for ticks.
  const legacy = cp.spawn(path.resolve(__dirname, `legacy.sh`), [], {
    stdio: [`pipe`, `pipe`, `pipe`]
  });

  legacy.stdout.on(`data`, (data) => console.log(`${data}`));
  legacy.stderr.on(`data`, (data) => console.error(`${data}`));

  legacy.on(`close`, () => {
    console.log(`done`);
    clearTimeout(timer);
  });
  legacy.on(`error`, (reason) => {
    console.error(reason);
    console.error(reason.stack);

    process.exit(1);
  });
}
catch (error) {
  console.error(error);
  process.exit(1);
}
