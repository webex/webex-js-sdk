/* eslint-disable max-nested-callbacks */
import React from 'react';
import renderer from 'react-test-renderer';

import {Provider} from 'react-redux';
import {applyMiddleware, combineReducers, compose, createStore} from 'redux';
import thunk from 'redux-thunk';

import {user, conversation, message} from '../../reducers';
import sparkReducer from '../../modules/redux-spark/reducers';


import ConnectedMessageComposer, {MessageComposer} from '.';
let component, store;

describe(`MessageComposer component`, () => {
  beforeEach(() => {
    store = createStore(
      combineReducers({
        user,
        conversation,
        message,
        spark: sparkReducer
      }),
      compose(applyMiddleware(thunk))
    );

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
        submitMessage: jest.fn()
      };
      const messageComposer = new MessageComposer(props);
      messageComposer.handleSubmit();
      expect(messageComposer.props.submitMessage).toHaveBeenCalled();
    });

    describe(`enter key processing`, () => {
      let event;
      const messageComposer = new MessageComposer();
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
