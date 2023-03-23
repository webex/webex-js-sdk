const { Jest } = require('@webex/legacy-tools');

describe('Jest', () => {
  describe('static', () => {
    describe('wrapper', () => {
      it('should return an object with the "run" method', () => {
        expect(typeof Jest.wrapper.run).toBe('function');
      });
    });

    describe('test()', () => {
      let config;
      const mocks = {};
      const spies = {};

      beforeEach(() => {
        config = {
          files: ['file1.js', 'file2.js', 'file3.js'],
        };

        mocks.wrapper = {
          run: () => Promise.resolve(),
        };

        spies.wrapper = {
          run: spyOn(mocks.wrapper, 'run').and.resolveTo(undefined),
        };

        spies.Jest = {
          wrapper: spyOnProperty(Jest, 'wrapper', 'get').and.returnValue(mocks.wrapper),
        };
      });

      it('should call "JestRunner.run()" with the provided files', () => Jest.test(config)
        .then(() => {
          expect(spies.wrapper.run).toHaveBeenCalledOnceWith(config.files);
        }));
    });
  });
});
