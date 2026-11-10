import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Certificate material and helpers for serving Karma over HTTPS.
 *
 * @public
 */
export interface HttpsSetup {
  /** Path to the mkcert root CA certificate used to sign `cert`. */
  caCertPath: string;
  /** PEM certificate for localhost.webex.com, localhost, 127.0.0.1 and ::1. */
  cert: string;
  /** PEM private key for `cert`. */
  key: string;
  /** Creates a Firefox profile directory that trusts the mkcert root CA. */
  createFirefoxProfile: () => string;
  /** Removes all generated files. */
  cleanup: () => void;
}

/**
 * Karma HTTPS utility methods, backed by mkcert (https://github.com/FiloSottile/mkcert).
 *
 * Webex services only accept CORS requests from allow-listed origins. Some reject `http://`
 * origins and others reject `https://localhost`, but all accept `https://*.webex.com` without a
 * port. `localhost.webex.com` resolves to 127.0.0.1 in public DNS, so setting `KARMA_HTTPS=true`
 * serves the Karma page from `https://localhost.webex.com` on port 443.
 *
 * @public
 */
class Https {
  /**
   * Name of the environment variable that enables HTTPS.
   */
  public static get ENV_VAR() {
    return 'KARMA_HTTPS';
  }

  /**
   * Hostname Karma is served from when HTTPS is enabled.
   */
  public static get HOSTNAME() {
    return 'localhost.webex.com';
  }

  /**
   * Port Karma is served on when HTTPS is enabled; the default HTTPS port keeps it out of the origin.
   */
  public static get PORT() {
    return 443;
  }

  /**
   * Whether HTTPS has been requested via the `KARMA_HTTPS` environment variable.
   *
   * @param env - Environment to read from.
   * @returns - True when `KARMA_HTTPS` is `true`.
   */
  public static isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[Https.ENV_VAR] === 'true';
  }

  /**
   * Generates a localhost certificate signed by the mkcert root CA.
   *
   * Chrome on Linux trusts the CA once `mkcert -install` has added it to the user's NSS database.
   * Karma launches Firefox with a throwaway profile, so `createFirefoxProfile()` imports the CA
   * into a profile with `certutil` (libnss3-tools).
   *
   * @returns - Certificate material and helpers.
   */
  public static setup(): HttpsSetup {
    Https.assertCanBindPort();

    const caRoot = Https.run('mkcert', ['-CAROOT'], 'mkcert must be installed and on the PATH');
    const caCertPath = path.join(caRoot, 'rootCA.pem');

    if (!fs.existsSync(caCertPath)) {
      throw new Error(`${Https.ENV_VAR}: mkcert root CA not found at ${caCertPath}, run "mkcert -install" first`);
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'karma-https-'));
    const certPath = path.join(dir, 'localhost.pem');
    const keyPath = path.join(dir, 'localhost-key.pem');
    const cleanup = () => {
      process.removeListener('exit', cleanup);
      fs.rmSync(dir, { recursive: true, force: true });
    };

    // Karma does not always invoke its completion callback (e.g. when the server fails to start).
    process.once('exit', cleanup);

    try {
      Https.run(
        'mkcert',
        ['-cert-file', certPath, '-key-file', keyPath, Https.HOSTNAME, 'localhost', '127.0.0.1', '::1'],
        'failed to generate a localhost certificate with mkcert',
      );

      return {
        caCertPath,
        cert: fs.readFileSync(certPath, 'utf8'),
        key: fs.readFileSync(keyPath, 'utf8'),
        createFirefoxProfile: () => {
          const profile = fs.mkdtempSync(path.join(dir, 'firefox-profile-'));
          const db = `sql:${profile}`;
          const hint = 'certutil (libnss3-tools) must be installed and on the PATH';

          Https.run('certutil', ['-N', '--empty-password', '-d', db], hint);
          Https.run('certutil', ['-A', '-n', 'mkcert development CA', '-t', 'C,,', '-i', caCertPath, '-d', db], hint);

          return profile;
        },
        cleanup,
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  /**
   * Fails fast with an actionable message when this process cannot listen on `Https.PORT`.
   */
  private static assertCanBindPort() {
    const sysctlPath = '/proc/sys/net/ipv4/ip_unprivileged_port_start';

    if (process.platform !== 'linux' || process.getuid?.() === 0 || !fs.existsSync(sysctlPath)) {
      return;
    }

    const unprivilegedPortStart = parseInt(fs.readFileSync(sysctlPath, 'utf8'), 10);

    if (unprivilegedPortStart > Https.PORT) {
      throw new Error(
        `${Https.ENV_VAR}: cannot listen on port ${Https.PORT}, `
        + `run "sudo sysctl -w net.ipv4.ip_unprivileged_port_start=${Https.PORT}" first`,
      );
    }
  }

  /**
   * Runs a command synchronously and returns its trimmed stdout.
   *
   * @param command - Executable to run.
   * @param args - Arguments for the executable.
   * @param hint - Context added to the error message on failure.
   * @returns - Trimmed stdout.
   */
  private static run(command: string, args: Array<string>, hint: string): string {
    try {
      return childProcess.execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (error: any) {
      throw new Error(`${Https.ENV_VAR}: ${hint} (${command} ${args.join(' ')}: ${error.message})`);
    }
  }
}

export default Https;
