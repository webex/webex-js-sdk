import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';


import Root from './root';
import injectLoader from './loader';

import './styles/main.css';

const defaultConfig = {
  accessToken: process.env.CISCOSPARK_ACCESS_TOKEN,
  userId: process.env.USERID,
  env: process.env.ENV_VARIABLE
};

function initChatWidget(element, config) {
  config = _.merge({}, defaultConfig, config);

  let root = <Root accessToken={config.accessToken} userId={config.userId} />;
  if (config.env !== `dev`) {
    root = injectLoader(root);
  }
  ReactDOM.render(
    root,
    element
  );

  return element;
}


function loadAllWidgets() {
  const widgets = document.querySelectorAll(`[data-toggle="spark-chat"]`);
  for (const widget of widgets) {
    initChatWidget(widget, {
      accessToken: widget.getAttribute(`data-access-token`) || undefined,
      userId: widget.getAttribute(`data-user-id`) || undefined
    });
  }
}

loadAllWidgets();

if (module.hot) {
  module.hot.accept();
}

export default loadAllWidgets;
