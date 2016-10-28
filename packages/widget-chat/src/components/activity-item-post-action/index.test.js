/* eslint-disable max-nested-callbacks */
import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemPostActions from '.';

describe(`ActivityItemPostActions component`, () => {
  const onDelete = jest.fn();
  describe(`show delete param`, () => {
    const component = renderer.create(
      <ActivityItemPostActions id="abc-123" onDelete={onDelete} showDelete />
  );

    it(`renders properly`, () => {
      expect(component).toMatchSnapshot();
    });
  });

  describe(`without show delete param`, () => {
    const component = renderer.create(
      <ActivityItemPostActions id="abc-123" onDelete={onDelete} showDelete={false} />
  );

    it(`renders properly`, () => {
      expect(component).toMatchSnapshot();
    });
  });

});
