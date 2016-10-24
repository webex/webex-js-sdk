import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';

import {formatDate} from '../../utils/date';

export default function ActivityList(props) {
  let lastActorId, lastVerb;
  const activities = props.activities
    .map((activity) => {
      const additional = lastActorId === activity.actor.id && lastVerb === activity.verb;
      lastActorId = activity.actor.id;
      lastVerb = activity.verb;
      return (
        <ActivityItem
          content={activity.object.displayName}
          id={activity.id}
          isAdditional={additional}
          isSelf={props.currentUserId === activity.actor.id}
          key={activity.id}
          name={activity.actor.displayName}
          onActivityDelete={props.onActivityDelete}
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
  currentUserId: PropTypes.string,
  onActivityDelete: PropTypes.func.isRequired
};
