import React from 'react';
import renderer from 'react-test-renderer';

import {Provider} from 'react-redux';
import {applyMiddleware, combineReducers, compose, createStore} from 'redux';
import thunk from 'redux-thunk';

import {user, conversation, message} from '../../reducers';
import sparkReducer from '../../modules/redux-spark/reducers';


import MessageComposer from '.';

describe(`MessageComposer component`, () => {
  const store = createStore(
    combineReducers({
      user,
      conversation,
      message,
      spark: sparkReducer
    }),
    compose(applyMiddleware(thunk))
  );

  const component = renderer.create(
    <Provider store={store}>
      <MessageComposer
        placeholder="Message Placeholder"
        value="This is a message"
      />
    </Provider>
  );

  it(`renders properly`, () => {
    const tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });

  // it(`sends message properly`, () => {});

  it(`handles value change properly`, () => {
    const value = `abc123`;
    const event = {
      target: {
        value
      }
    };
    let tree = component.toJSON();
    expect(tree).toMatchSnapshot();
    const textarea = tree.children[0];
    textarea.props.onChange(event);
    tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });

});
