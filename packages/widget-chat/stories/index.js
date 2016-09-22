import React from 'react';
import {storiesOf} from '@kadira/storybook';
import ChatWidget from '../src/containers/chat-widget';

storiesOf(`ChatWidget`, module)
  .add(`basic`, () =>
    <ChatWidget />
  );
