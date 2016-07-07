import {wd} from '@ciscospark/test-helper-automation';
import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../../package.json';

const droneBrowsers = new WeakMap();
const droneUsers = new WeakMap();

wd.addPromiseChainMethod(`bdInit`, function(user) {
  // TODO use mac chrome once it's possible to prove cross-browser support
  return Promise.all([
    [user] || testUsers.create({count: 1}),
    createBrowser(pkg, {
      platform: `Linux`,
      browserName: `firefox`,
      version: `latest`,
      name: `drone`
    })
  ])
    .then(([users, drone]) => {
      const [user] = users;
      droneUsers.set(this, user);
      droneBrowsers.set(this, drone);

      return drone
        .setImplicitWaitTimeout(20000)
        .loginWithLocalStorage(user)
        .clickOnTitle(`Link to Call Page`);
    })
    .then(() => this);
});

wd.addPromiseChainMethod(`bdAnswerCall`, function() {
  return droneBrowsers.get(this)
    .answerCall()
    .then(() => this);
});

wd.addPromiseChainMethod(`bdDeclineCall`, function() {
  return droneBrowsers.get(this)
    .declineCall()
    .then(() => this);
});

wd.addPromiseChainMethod(`bdEndCall`, function() {
  return droneBrowsers.get(this)
    .endCall()
    .then(() => this);
});

wd.addPromiseChainMethod(`bdPlaceCall`, function(dialString) {
  return droneBrowsers.get(this)
    .placeCall(dialString)
    .then(() => this);
});

wd.addPromiseChainMethod(`bdDeinit`, function() {
  return Promise.resolve(droneBrowsers.get(this) && droneBrowsers.get(this).quit());
});

wd.addPromiseChainMethod(`bdGet`, function() {
  return Promise.resolve(droneBrowsers.get(this));
});
