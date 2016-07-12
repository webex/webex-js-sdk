import '../styles/style.css';

import React from 'react';
import ReactDOM from 'react-dom';
import {hashHistory} from 'react-router';
import {syncHistoryWithStore} from 'react-router-redux';

import Root from './root';
import store from './store';

const history = syncHistoryWithStore(hashHistory, store);

ReactDOM.render(
  <Root history={history} store={store} />,
  document.getElementById(`main`)
);

if (module.hot) {
  module.hot.accept();
}
