import React from 'react';
import {Provider} from 'react-redux';

import ChatWidget from './containers/chat-widget';
import store from './store';


export default function Root() {
  const accessToken = process.env.CISCOSPARK_ACCESS_TOKEN;
  return (
    <Provider store={store}>
      <ChatWidget accessToken={accessToken} userId="bernie.zang@gmail.com" />
    </Provider>
  );
}
