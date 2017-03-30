import {Exception} from '../..';
import {assert} from '@ciscospark/test-helper-chai';

describe(`common`, () => {
  describe(`Exception`, () => {
    describe(`#defaultMessage`, () => {
      it(`gets used when no messsage is supplied`, () => {
        const exception = new Exception();
        assert.match(exception.message, /An error occurred/);
        assert.match(exception.toString(), /An error occurred/);
      });

      it(`gets overridden by derived classes`, () => {
        class MyException extends Exception {
          static defaultMessage = `My exception occurred`;
        }
        const exception = new MyException();
        assert.match(exception.message, /My exception occurred/);
        assert.match(exception.toString(), /My exception occurred/);
      });
    });

    it(`stringifies usefully`, () => {
      class MyException extends Exception {
        static defaultMessage = `My exception occurred`;
      }

      const m = new MyException();
      assert.match(m.toString(), /MyException:/);
    });
  });
});
