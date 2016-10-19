import React, {PropTypes} from 'react';
import {Provider} from 'react-redux';

import injectWidgetLoader from './loader';
import ChatWidget from './containers/chat-widget';
import store from './store';

import './styles/main.css';

function Root({accessToken, userId}) {
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

export default injectWidgetLoader(Root);
