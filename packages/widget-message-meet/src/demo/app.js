import React from 'react';
import ReactDOM from 'react-dom';

import DemoApp from './demo';


function loadDemo() {
  ReactDOM.render(
    <DemoApp />,
    document.getElementById(`main`)
  );
}

document.addEventListener(`DOMContentLoaded`, loadDemo, false);

if (module.hot) {
  module.hot.accept();
}
