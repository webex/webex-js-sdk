import React from 'react';
import {Provider} from 'react-redux';

import ChatWidget from './containers/chat-widget';
import store from './store';

export default function Root() {
  return (
    <Provider store={store}>
      <ChatWidget userId="bernie.zang@gmail.com" />
    </Provider>
  );
}
