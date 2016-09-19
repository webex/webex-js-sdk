import React from 'react';
import { storiesOf, action, linkTo } from '@kadira/storybook';
import ChatWidget from '../src/chat-widget';

storiesOf('ChatWidget', module)
  .add('basic', () => (
    <ChatWidget />
  ));
