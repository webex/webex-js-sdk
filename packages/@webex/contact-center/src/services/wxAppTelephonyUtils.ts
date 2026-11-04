/**
 * Expected Hydra responses when mute backfill races call creation (WXCC-6026).
 * These must not be logged as errors — see task-spec wxApp mute backfill guard.
 */
export function isWxAppCallNotFoundError(error: unknown): boolean {
  const err = error as {status?: number | string; message?: string};
  if (err?.status === 400 || err?.status === '400') {
    return true;
  }

  const message = String(err?.message ?? error ?? '');

  return message.includes('Call not found') || message.includes('101002');
}
