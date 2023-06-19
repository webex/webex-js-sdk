/* eslint-disable valid-jsdoc */
expect.extend({
  /**
   * @param received - result we received from an action
   * @param {...any} expected - result we are expecting from an action
   */
  toBeCalledOnceWith(received, ...expected) {
    try {
      expect(received).toBeCalledTimes(1);
      expect(received).toBeCalledWith(...expected);
    } catch (error) {
      return {
        message: () => error,
        pass: false,
      };
    }

    return {pass: true};
  },
});
