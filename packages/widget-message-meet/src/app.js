import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';

import Root from './root';

import './styles/main.css';

const defaultConfig = {
  accessToken: process.env.CISCOSPARK_ACCESS_TOKEN,
  toPersonEmail: process.env.TO_PERSON_EMAIL,
  toPersonId: process.env.TO_PERSON_ID,
  env: process.env.ENV_VARIABLE
};

export function initMessageMeetWidget(element, config) {
  config = _.merge({}, defaultConfig, config);

  ReactDOM.render(
    <Root accessToken={config.accessToken} toPersonEmail={config.toPersonEmail} toPersonId={config.toPersonId} />,
    element
  );

  return element;
}


function loadAllWidgets() {
  const widgets = document.querySelectorAll(`[data-toggle="spark-message-meet"]`);
  for (const widget of widgets) {
    initMessageMeetWidget(widget, {
      accessToken: widget.getAttribute(`data-access-token`) || undefined,
      toPersonEmail: widget.getAttribute(`data-to-person-email`) || undefined,
      toPersonId: widget.getAttribute(`data-to-person-id`) || undefined
    });
  }
}

loadAllWidgets();

if (module.hot) {
  module.hot.accept();
}

export default loadAllWidgets;
