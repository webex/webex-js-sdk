/* eslint-disable no-await-in-loop */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

type SerialResourceLockOptions = {
  pollMs?: number;
  staleMs?: number;
  timeoutMs?: number;
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const readOwnerPid = async (lockDir: string): Promise<number | undefined> => {
  const owner = await fs.readFile(path.join(lockDir, 'owner'), 'utf8').catch(() => '');
  const pid = Number(owner.split(':')[0]);

  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as {code?: string}).code === 'EPERM';
  }
};

export async function acquireSerialResourceLock(
  name: string,
  options: SerialResourceLockOptions = {}
): Promise<() => Promise<void>> {
  const {pollMs = 1000, staleMs = 3 * 60 * 60 * 1000, timeoutMs = 90 * 60 * 1000} = options;
  const lockDir = path.join(os.tmpdir(), `webex-js-sdk-${name}.lock`);
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await fs.mkdir(lockDir);
      await fs.writeFile(path.join(lockDir, 'owner'), token, 'utf8');

      let released = false;

      return async () => {
        if (released) {
          return;
        }

        released = true;
        const owner = await fs.readFile(path.join(lockDir, 'owner'), 'utf8').catch(() => '');
        if (owner === token) {
          await fs.rm(lockDir, {force: true, recursive: true});
        }
      };
    } catch (error) {
      if ((error as {code?: string}).code !== 'EEXIST') {
        throw error;
      }

      const stats = await fs.stat(lockDir).catch(() => undefined);
      const ownerPid = await readOwnerPid(lockDir);
      const ownerAgeMs = stats ? Date.now() - stats.mtimeMs : 0;
      const shouldBreakLock =
        (ownerPid !== undefined && !isProcessAlive(ownerPid)) ||
        (stats && ownerAgeMs > (ownerPid ? staleMs : pollMs * 5));

      if (shouldBreakLock) {
        await fs.rm(lockDir, {force: true, recursive: true}).catch(() => {});
      } else {
        await sleep(pollMs);
      }
    }
  }

  throw new Error(`Timed out waiting for serial resource lock '${name}'`);
}
