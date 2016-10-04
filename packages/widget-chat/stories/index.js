import React from 'react';
import {storiesOf} from '@kadira/storybook';

import ActivityItem from '../src/components/activity-item';
import ActivityList from '../src/components/activity-list';
import ActivityReadReceipt from '../src/components/activity-read-receipt';
import TitleBar from '../src/components/title-bar';
import Avatar from '../src/components/avatar';
import MessageComposer from '../src/components/message-composer';

const testUser = {
  id: `bernie@gmail.net`,
  displayName: `Bernie`
};

storiesOf(`ActivityItem`, module)
  .add(`message`, () => {
    const activity = {
      id: `abc124`,
      user: {
        userId: `bernie@aol.net`,
        isSelf: false
      },
      activity: {
        message: `hey, what's up?!`
      }
    };
    return <ActivityItem activity={activity} />;
  });

storiesOf(`ActivityList`, module)
  .add(`messages`, () => {
    const activities = [
      {
        id: `abc124`,
        user: {
          userId: `bernie@aol.net`,
          isSelf: false
        },
        activity: {
          message: `hey, what's up?!`
        }
      },
      {
        id: `abc125`,
        user: {
          userId: `earl@aol.net`,
          isSelf: false
        },
        activity: {
          message: `hello, how's it going?`
        }
      }
    ];
    return <ActivityList activities={activities} />;
  });

storiesOf(`ActivityReadReceipt`, module)
  .add(`Basic`, () => {
    const mockReadUsers = [{userId: `bernie`}, {userId: `adam`}];
    return <ActivityReadReceipt actors={mockReadUsers} />;
  });

storiesOf(`TitleBar`, module)
  .add(`Default User`, () =>
    <TitleBar user={testUser} />
  );

storiesOf(`Avatar`, module)
  .add(`letter B`, () =>
    <Avatar displayName="Beta" />
  )
  .add(`letter D`, () =>
    <Avatar displayName="Delta" />
  );

storiesOf(`MessageComposer`, module)
  .add(`Basic`, () =>
    <MessageComposer />
  );
