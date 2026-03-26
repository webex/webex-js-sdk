import * as jose from 'jose';

const EXPIRY_BUFFER = 30 * 1000;

// eslint-disable-next-line import/prefer-default-export
export const isJwtTokenExpired = (token: string): boolean => {
  try {
    const payload = jose.decodeJwt(token);

    if (!payload?.exp) return false;

    return payload.exp * 1000 < Date.now() + EXPIRY_BUFFER;
  } catch {
    return true;
  }
};
