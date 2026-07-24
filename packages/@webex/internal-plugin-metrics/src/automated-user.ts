import {createIsBotFromList, list} from 'isbot';

const AUTOMATED_USER_AGENT_PATTERNS = [...list, 'SkypeUriPreview'];
const isBotUserAgent = createIsBotFromList(AUTOMATED_USER_AGENT_PATTERNS);

export const isAutomatedUserAgent = (userAgent?: string | null): boolean =>
  isBotUserAgent(userAgent);

let automatedUser: boolean | undefined;

export const isAutomatedUser = (): boolean => {
  if (automatedUser === undefined) {
    automatedUser =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      (Boolean(navigator.webdriver) || isAutomatedUserAgent(navigator.userAgent));
  }

  return automatedUser;
};
