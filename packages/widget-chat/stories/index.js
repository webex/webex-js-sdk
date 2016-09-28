import React from 'react';
import {storiesOf} from '@kadira/storybook';
import ChatWidget from '../src/containers/chat-widget';
import ActivityTitle from '../src/components/activity-title';
import ActivityTitleBar from '../src/components/activity-title-bar';
import Avatar from '../src/components/avatar';

const testUser = {
  userId: `bernie@gmail.net`
};

storiesOf(`ChatWidget`, module)
  .add(`basic`, () =>
    <ChatWidget />
  );


storiesOf(`ActivityTitle`, module)
  .add(`Welcome Text`, () =>
    <ActivityTitle heading="This is an Activity Title" />
  );

storiesOf(`ActivityTitleBar`, module)
  .add(`Default User`, () =>
    <ActivityTitleBar user={testUser} />
  );

storiesOf(`Avatar`, module)
  .add(`letter B`, () =>
    <Avatar user={testUser} />
  )
  .add(`letter D`, () => {
    const dUser = {
      userId: `dis.user@netscape.net`
    };
    return (
      <Avatar user={dUser} />
    );
  });
