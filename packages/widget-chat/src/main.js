import './styles/styles.css';

import React from 'react';
import ReactDOM from 'react-dom';
import ChatWidget from './ChatWidget';


ReactDOM.render(
  <div>
    <ChatWidget />
  </div>,
  document.getElementById(`main`)
);

if (module.hot) {
  module.hot.accept();
}
