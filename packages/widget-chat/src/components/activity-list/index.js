import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';

import {formatDate} from '../../utils/date';

export default function ActivityList(props) {
  let lastActorId, lastVerb;
  const {avatars, flags} = props;
  const activities = props.activities
    .map((activity) => {
      const additional = lastActorId === activity.actor.id && lastVerb === activity.verb;
      lastActorId = activity.actor.id;
      lastVerb = activity.verb;
      const isFlagged = flags && flags.some((flag) => flag.activityUrl === activity.url);
      return (
        <ActivityItem
          avatarUrl={avatars[activity.actor.id]}
          content={activity.object.displayName}
          id={activity.id}
          isAdditional={additional}
          isFlagged={isFlagged}
          isSelf={props.currentUserId === activity.actor.id}
          key={activity.id}
          name={activity.actor.displayName}
          onActivityDelete={props.onActivityDelete}
          onActivityFlag={props.onActivityFlag}
          timestamp={formatDate(activity.published)}
          verb={activity.verb}
        />
      );
    });

  return (
    <div className={classNames(`activity-list`)}>
      {activities}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array,
  avatars: PropTypes.object.isRequired,
  currentUserId: PropTypes.string,
  flags: PropTypes.array,
  onActivityDelete: PropTypes.func.isRequired,
  onActivityFlag: PropTypes.func.isRequired
};
