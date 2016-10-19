/* eslint-disable max-nested-callbacks */
import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemPostActions from '.';

describe(`ActivityItemPostActions component`, () => {
  const onDelete = jest.fn();
  describe(`is self param`, () => {
    const component = renderer.create(
      <ActivityItemPostActions id="abc-123" isSelf="true" onDelete={onDelete} />
  );

    it(`renders properly`, () => {
      expect(component).toMatchSnapshot();
    });
  });

  describe(`without is self param`, () => {
    const component = renderer.create(
      <ActivityItemPostActions id="abc-123" onDelete={onDelete} />
  );

    it(`renders properly`, () => {
      expect(component).toMatchSnapshot();
    });
  });

});
