import React from 'react';
import ReactDOM from 'react-dom';

import Root from './root';


ReactDOM.render(
  <Root />,
  document.getElementById(`main`)
);

if (module.hot) {
  module.hot.accept();
}
