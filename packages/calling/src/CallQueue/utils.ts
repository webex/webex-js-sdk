import type {WebexSDK} from '../SDKConnector/types';

/** Device registration may populate entitlement models incrementally. */
export function hasReadyEntitlementModels(webex: WebexSDK): boolean {
  const models = webex.internal.device?.features?.entitlement?.models;

  return Array.isArray(models) && models.every((model) => typeof model?._values?.key === 'string');
}

export default function actorIdentity(value: string): {id: string; type?: string} {
  const parse = (candidate: string) =>
    /^ciscospark:\/\/[^/]+\/(PEOPLE|PERSON|VIRTUAL_LINE)\/([^/]+)$/i.exec(candidate);
  let match = parse(value);
  if (!match) {
    try {
      match = parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      // An unencoded actor ID is also valid.
    }
  }

  return match
    ? {type: match[1].toUpperCase(), id: match[2].toLowerCase()}
    : {id: value.toLowerCase()};
}
