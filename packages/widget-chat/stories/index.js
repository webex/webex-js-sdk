import React from 'react';
import {storiesOf} from '@kadira/storybook';

import ActivityItem from '../src/components/activity-item';
import ActivityList from '../src/components/activity-list';
import ActivityReadReceipt from '../src/components/activity-read-receipt';
import ActivityTitle from '../src/components/activity-title';
import ActivityTitleBar from '../src/components/activity-title-bar';
import Avatar from '../src/components/avatar';
import MessageComposer from '../src/components/message-composer';

const testUser = {
  userId: `bernie@gmail.net`
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
    return <ActivityReadReceipt actors={mockReadUsers}/>;
  });

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

storiesOf(`MessageComposer`, module)
  .add(`Basic`, () =>
    <MessageComposer />
  );
