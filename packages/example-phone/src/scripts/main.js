import React from 'react';
import ReactDOM from 'react-dom';
import {browserHistory} from 'react-router';
import {syncHistoryWithStore} from 'react-router-redux';

import Root from './root';
import store from './store';

const history = syncHistoryWithStore(browserHistory, store);

ReactDOM.render(
  <Root history={history} store={store} />,
  document.getElementById(`main`)
);

if (module.hot) {
  module.hot.accept();
}
