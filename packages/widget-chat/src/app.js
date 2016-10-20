import React from 'react';
import ReactDOM from 'react-dom';

import Root from './root';

import './styles/main.css';

const accessToken = process.env.CISCOSPARK_ACCESS_TOKEN;
const userId = process.env.USERID;

ReactDOM.render(
  <Root accessToken={accessToken} userId={userId} />,
  document.getElementById(`main`)
);

if (module.hot) {
  module.hot.accept();
}
