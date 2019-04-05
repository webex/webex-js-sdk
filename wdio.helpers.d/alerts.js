const {assert} = require('chai');

const addCommand = require('./lib/add-command');

addCommand('acceptAlert', function acceptAlert(timeout = 5000) {
  this.waitUntil(() => {
    try {
      this.alertAccept();

      return true;
    }
    catch (err) {
      if (err.seleniumStack && err.seleniumStack.type === 'NoAlertOpenError') {
        return false;
      }

      console.warn(err);
      throw err;
    }
  }, timeout, `Could not accept an alert within ${timeout}ms due to no alert being open`);
});

addCommand('dismissAlert', function dismissAlert(timeout = 5000) {
  this.waitUntil(() => {
    try {
      this.alertDismiss();

      return true;
    }
    catch (err) {
      if (err.seleniumStack && err.seleniumStack.type === 'NoAlertOpenError') {
        return false;
      }

      console.warn(err);
      throw err;
    }
  }, timeout, `Could not dismiss an alert within ${timeout}ms due to no alert being open`);
});

addCommand('assertNoAlert', function assertNoAlert() {
  try {
    const text = this.alertText();

    assert.fail(`An alert with text "${text}" was unexpectedly open`);
  }
  catch (err) {
    // expected. this is the success condition.
  }
});
