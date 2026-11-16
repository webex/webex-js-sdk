const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Karma } = require('@webex/legacy-tools');

describe('Karma', () => {
  describe('static', () => {
    describe('Https', () => {
      const { Https } = Karma;

      describe('static', () => {
        describe('ENV_VAR', () => {
          it('should be KARMA_HTTPS', () => {
            expect(Https.ENV_VAR).toBe('KARMA_HTTPS');
          });
        });

        describe('HOSTNAME', () => {
          it('should be a webex.com host that resolves to localhost', () => {
            expect(Https.HOSTNAME).toBe('localhost.webex.com');
          });
        });

        describe('PORT', () => {
          it('should be the default https port so it is omitted from the origin', () => {
            expect(Https.PORT).toBe(443);
          });
        });
      });

      describe('isEnabled()', () => {
        [
          { value: 'true', expected: true },
          { value: 'false', expected: false },
          { value: '1', expected: false },
          { value: undefined, expected: false },
        ].forEach(({ value, expected }) => {
          it(`should return ${expected} when KARMA_HTTPS is ${value}`, () => {
            expect(Https.isEnabled({ KARMA_HTTPS: value })).toBe(expected);
          });
        });

        it('should read process.env by default', () => {
          const original = process.env.KARMA_HTTPS;

          try {
            process.env.KARMA_HTTPS = 'true';

            expect(Https.isEnabled()).toBe(true);
          } finally {
            if (original === undefined) {
              delete process.env.KARMA_HTTPS;
            } else {
              process.env.KARMA_HTTPS = original;
            }
          }
        });
      });

      describe('assertCanBindPort()', () => {
        const sysctlPath = '/proc/sys/net/ipv4/ip_unprivileged_port_start';
        let platform;

        beforeEach(() => {
          platform = Object.getOwnPropertyDescriptor(process, 'platform');
        });

        afterEach(() => {
          Object.defineProperty(process, 'platform', platform);
        });

        [
          {
            name: 'allow binding when not on linux', platform: 'darwin', uid: 1000, sysctl: '1024', throws: false,
          },
          {
            name: 'allow binding when running as root', platform: 'linux', uid: 0, sysctl: '1024', throws: false,
          },
          {
            name: 'allow binding when the sysctl is unavailable', platform: 'linux', uid: 1000, sysctl: undefined, throws: false,
          },
          {
            name: 'allow binding when unprivileged ports start at 443', platform: 'linux', uid: 1000, sysctl: '443', throws: false,
          },
          {
            name: 'allow binding when unprivileged ports start at 0', platform: 'linux', uid: 1000, sysctl: '0\n', throws: false,
          },
          {
            name: 'throw with the sysctl command when port 443 is privileged', platform: 'linux', uid: 1000, sysctl: '1024\n', throws: true,
          },
        ].forEach((testCase) => {
          it(`should ${testCase.name}`, () => {
            Object.defineProperty(process, 'platform', { ...platform, value: testCase.platform });
            spyOn(process, 'getuid').and.returnValue(testCase.uid);

            const { existsSync, readFileSync } = fs;

            spyOn(fs, 'existsSync').and.callFake((file) => (file === sysctlPath
              ? testCase.sysctl !== undefined
              : existsSync(file)));
            spyOn(fs, 'readFileSync').and.callFake((file, ...args) => (file === sysctlPath
              ? testCase.sysctl
              : readFileSync(file, ...args)));

            if (testCase.throws) {
              expect(() => Https.assertCanBindPort()).toThrowError(
                /cannot listen on port 443, run "sudo sysctl -w net.ipv4.ip_unprivileged_port_start=443" first/,
              );
            } else {
              expect(() => Https.assertCanBindPort()).not.toThrow();
            }
          });
        });
      });

      describe('setup()', () => {
        let caRoot;
        let execFileSync;

        beforeEach(() => {
          caRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'karma-https-test-ca-'));
          fs.writeFileSync(path.join(caRoot, 'rootCA.pem'), 'ca');

          spyOn(Https, 'assertCanBindPort').and.returnValue(undefined);

          // Fake mkcert/certutil: report the CA root and write the requested cert/key files.
          execFileSync = spyOn(childProcess, 'execFileSync').and.callFake((command, args) => {
            if (command === 'mkcert' && args[0] === '-CAROOT') {
              return `${caRoot}\n`;
            }
            if (command === 'mkcert') {
              fs.writeFileSync(args[args.indexOf('-cert-file') + 1], 'cert');
              fs.writeFileSync(args[args.indexOf('-key-file') + 1], 'key');
            }

            return '';
          });
        });

        afterEach(() => {
          fs.rmSync(caRoot, { recursive: true, force: true });
        });

        it('should generate a certificate for the https hostname and localhost', () => {
          const https = Https.setup();

          const [command, args] = execFileSync.calls.all()[1].args;

          expect(command).toBe('mkcert');
          expect(args.slice(4)).toEqual(['localhost.webex.com', 'localhost', '127.0.0.1', '::1']);
          expect(https.cert).toBe('cert');
          expect(https.key).toBe('key');
          expect(https.caCertPath).toBe(path.join(caRoot, 'rootCA.pem'));

          https.cleanup();
        });

        it('should create a firefox profile that trusts the mkcert root CA', () => {
          const https = Https.setup();
          const profile = https.createFirefoxProfile();
          const certutilCalls = execFileSync.calls.all()
            .filter(({ args }) => args[0] === 'certutil')
            .map(({ args }) => args[1]);

          expect(fs.existsSync(profile)).toBe(true);
          expect(certutilCalls).toEqual([
            ['-N', '--empty-password', '-d', `sql:${profile}`],
            ['-A', '-n', 'mkcert development CA', '-t', 'C,,', '-i', https.caCertPath, '-d', `sql:${profile}`],
          ]);

          https.cleanup();
        });

        it('should remove generated files on cleanup', () => {
          const https = Https.setup();
          const profile = https.createFirefoxProfile();

          https.cleanup();

          expect(fs.existsSync(profile)).toBe(false);
        });

        it('should throw a helpful error when mkcert is not installed', () => {
          execFileSync.and.throwError(new Error('spawnSync mkcert ENOENT'));

          expect(() => Https.setup()).toThrowError(/KARMA_HTTPS: mkcert must be installed/);
        });

        it('should throw a helpful error when the mkcert root CA does not exist', () => {
          fs.rmSync(path.join(caRoot, 'rootCA.pem'));

          expect(() => Https.setup()).toThrowError(/run "mkcert -install" first/);
        });

        it('should throw before generating anything when the port cannot be bound', () => {
          Https.assertCanBindPort.and.throwError(new Error('cannot listen'));

          expect(() => Https.setup()).toThrowError('cannot listen');
          expect(execFileSync).not.toHaveBeenCalled();
        });
      });
    });
  });
});
