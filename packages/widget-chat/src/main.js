import './styles/styles.css';

import React from 'react';
import ReactDOM from 'react-dom';

ReactDOM.render(
  <h1>Chat Widget!</h1>,
  document.getElementById(`main`)
);

if (module.hot) {
  module.hot.accept();
}
