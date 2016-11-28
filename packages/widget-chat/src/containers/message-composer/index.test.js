/* eslint-disable max-nested-callbacks */
import React from 'react';
import renderer from 'react-test-renderer';
import {Map} from 'immutable';
import {Provider} from 'react-redux';

import store from '../../store.js';
import ConnectedMessageComposer, {MessageComposer} from '.';

let component;

describe(`MessageComposer component`, () => {
  beforeEach(() => {
    component = renderer.create(
      <Provider store={store}>
        <ConnectedMessageComposer
          placeholder="Message Placeholder"
          value="This is a message"
        />
      </Provider>
    );
  });

  describe(`snapshot tests`, () => {
    it(`renders properly`, () => {
      const tree = component.toJSON();
      expect(tree).toMatchSnapshot();
    });

    it(`handles value change properly`, () => {
      const value = `abc123`;
      const event = {
        target: {
          value
        }
      };
      let tree = component.toJSON();
      expect(tree).toMatchSnapshot();
      // Not need better way to grab child nodes
      const textarea = tree.children[1].children[0];
      textarea.props.onChange(event);
      tree = component.toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe(`class method tests`, () => {
    it(`sends message properly`, () => {
      const props = {
        activity: new Map(),
        submitActivity: jest.fn()
      };
      const messageComposer = new MessageComposer(props);
      messageComposer.handleSubmit();
      expect(messageComposer.props.submitActivity).toHaveBeenCalled();
    });

    describe(`enter key processing`, () => {
      let event;
      const props = {
        activity: new Map()
      };
      const messageComposer = new MessageComposer(props);
      beforeEach(() => {
        messageComposer.handleSubmit = jest.fn();
        event = {
          keyCode: 13,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          preventDefault: jest.fn()
        };
      });

      it(`submits upon enter key with no modifiers`, () => {
        messageComposer.handleKeyDown(event);
        expect(messageComposer.handleSubmit).toHaveBeenCalled();
      });

      it(`doesn't submit upon enter key with shift modifiers`, () => {
        event.shiftKey = true;
        messageComposer.handleKeyDown(event);
        expect(messageComposer.handleSubmit).not.toHaveBeenCalled();
      });

      it(`doesn't submit upon enter key with alt modifiers`, () => {
        event.altKey = true;
        messageComposer.handleKeyDown(event);
        expect(messageComposer.handleSubmit).not.toHaveBeenCalled();
      });

      it(`doesn't submit upon enter key with ctrl modifiers`, () => {
        event.ctrlKey = true;
        messageComposer.handleKeyDown(event);
        expect(messageComposer.handleSubmit).not.toHaveBeenCalled();
      });

      it(`doesn't submit upon enter key with meta modifiers`, () => {
        event.metaKey = true;
        messageComposer.handleKeyDown(event);
        expect(messageComposer.handleSubmit).not.toHaveBeenCalled();
      });
    });
  });
});
