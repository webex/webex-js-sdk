import React, {PropTypes} from 'react';
import {Provider} from 'react-redux';

import ChatWidget from './containers/chat-widget';
import store from './store';

export default function Root({accessToken, userId}) {
  return (
    <Provider store={store}>
      <ChatWidget accessToken={accessToken} userId={userId} />
    </Provider>
  );
}

Root.propTypes = {
  accessToken: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired
};
