import {isMobiusWssHostAllowed} from './constants';

describe('isMobiusWssHostAllowed', () => {
  it('allows a host that exactly matches an allowlisted domain', () => {
    expect(isMobiusWssHostAllowed('webex.com')).toBe(true);
  });

  it('allows a subdomain of an allowlisted domain', () => {
    expect(isMobiusWssHostAllowed('mobius.webex.com')).toBe(true);
  });

  it('rejects a host that is not in the allowlist', () => {
    expect(isMobiusWssHostAllowed('evil.example.com')).toBe(false);
  });

  it('rejects a host that only shares a suffix without the dot boundary', () => {
    expect(isMobiusWssHostAllowed('notwebex.com')).toBe(false);
  });
});
