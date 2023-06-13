import Webex from 'webex';

/**
 * @param token - Acces token of the user.
 */
export const initializeWebex = (token) => {
  const webex = Webex.init({
    credentials: {
      access_token: token,
    },
  });

  return webex;
};
