import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';
import injectScrollable from '../../containers/wrapper-scrollable';

import {formatDate} from '../../utils/date';

import styles from './styles.css';

function ActivityList(props) {
  let lastActorId;
  const activities = props.activities
    .map((activity) => {
      const additional = lastActorId === activity.actor.id;
      lastActorId = activity.actor.id;
      return (
        <ActivityItem
          content={activity.object.displayName}
          id={activity.id}
          isAdditional={additional}
          isSelf={props.currentUserId === activity.actorId}
          key={activity.id}
          name={activity.actor.displayName}
          onActivityDelete={props.onActivityDelete}
          timestamp={formatDate(activity.published)}
          verb={activity.verb}
        />
      );
    });

  return (
    <div className={classNames(`activity-list`, styles.activityList)}>
      {activities}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array,
  currentUserId: PropTypes.string,
  onActivityDelete: PropTypes.func.isRequired
};

export default injectScrollable(ActivityList);
