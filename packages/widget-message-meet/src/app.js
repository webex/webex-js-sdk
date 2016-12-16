import React from 'react';
import ReactDOM from 'react-dom';

import RootForm from './root-form';
import Root from './root';

import './styles/main.css';

export function initMessageMeetWidget(element, config) {
  if (config.displayAuth) {
    ReactDOM.render(
      <RootForm accessToken={config.accessToken} toPersonEmail={config.toPersonEmail} toPersonId={config.toPersonId} />,
      element
    );
  }
  else {
    ReactDOM.render(
      <Root accessToken={config.accessToken} toPersonEmail={config.toPersonEmail} toPersonId={config.toPersonId} />,
      element
    );
  }
  return element;
}

function loadAllWidgets() {
  const widgets = document.querySelectorAll(`[data-toggle="spark-message-meet"]`);
  for (const widget of widgets) {
    initMessageMeetWidget(widget, {
      accessToken: widget.getAttribute(`data-access-token`) || undefined,
      displayAuth: widget.getAttribute(`data-display-auth`) || undefined,
      toPersonEmail: widget.getAttribute(`data-to-person-email`) || undefined,
      toPersonId: widget.getAttribute(`data-to-person-id`) || undefined
    });
  }
}

document.addEventListener(`DOMContentLoaded`, loadAllWidgets, false);

if (module.hot) {
  module.hot.accept();
}

export default loadAllWidgets;
