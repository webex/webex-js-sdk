import React from 'react';
import ReactDOM from 'react-dom';

import DemoApp from './demo';


function loadDemo() {
  ReactDOM.render(
    <DemoApp />,
    document.getElementById(`spark-message-meet`)
  );
}

document.addEventListener(`DOMContentLoaded`, loadDemo, false);

if (module.hot) {
  module.hot.accept();
}
