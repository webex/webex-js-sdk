import React from 'react';
import {findRenderedDOMComponentWithTag, renderIntoDocument} from 'react-addons-test-utils';

import ActivityList from '.';

describe(`ActivityList component`, () => {
  let activities;
  let component;
  beforeEach(() => {
    activities = [{id: `bac`, activity: {message: `howdy`}}, {id: `abc`, activity: {message: `hi`}}];
    component = renderIntoDocument(
      <ActivityList activities={activities} />
    );
  });

  it(`is rendered properly`, () => {
    const componentNode = findRenderedDOMComponentWithTag(component, `ul`);
    expect(componentNode.textContent).toEqual(`howdyhi`);
  });

});
