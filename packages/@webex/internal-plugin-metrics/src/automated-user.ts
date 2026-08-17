import {isBot} from 'isbot';

export const isAutomatedUserAgent = (userAgent?: string | null): boolean => isBot(userAgent);

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
