import React, {PropTypes} from 'react';
import classNames from 'classnames';
import moment from 'moment';
import ActivityItem from '../activity-item';
import DaySeparator from '../day-separator';
import NewMessagesSeparator from '../new-messages-separator';
import {formatDate} from '../../utils/date';

export default function ActivityList(props) {
  let lastActorId, lastDay, lastVerb;
  const now = moment();
  const {avatars, currentUserId, flags, lastAcknowledgedActivityId, onActivityDelete, onActivityFlag} = props;
  const items = [];
  let shouldDisplayNewMessageMarker = false;
  props.activities.forEach((activity) => {
    // Insert day separator if this activity and last one happen on a different day
    const activityMoment = moment(activity.published, moment.ISO_8601);
    const activityDay = activityMoment.endOf(`day`);
    const sameDay = activityDay.diff(lastDay, `days`) === 0;
    if (lastDay && !sameDay) {
      items.push(
        <DaySeparator
          fromDate={lastDay}
          key={`day-separtor-${activity.id}`}
          now={now}
          toDate={activityDay}
        />
      );
    }
    lastDay = activityDay;

    if (shouldDisplayNewMessageMarker) {
      items.push(<NewMessagesSeparator key={`new-messages-${activity.id}`} />);
      shouldDisplayNewMessageMarker = false;
    }

    // additional items don't repeat user avatar and name
    const additional = sameDay && lastActorId === activity.actor.id && lastVerb === activity.verb;
    lastActorId = activity.actor.id;
    lastVerb = activity.verb;
    const isFlagged = flags && flags.some((flag) => flag.activityUrl === activity.url);
    items.push(
      <ActivityItem
        activity={activity.object}
        avatarUrl={avatars[activity.actor.id]}
        id={activity.id}
        isAdditional={additional}
        isFlagged={isFlagged}
        isSelf={currentUserId === activity.actor.id}
        key={activity.id}
        name={activity.actor.displayName}
        onActivityDelete={onActivityDelete}
        onActivityFlag={onActivityFlag}
        timestamp={formatDate(activity.published)}
        verb={activity.verb}
      />
    );

    // if this activity is last acked by user render the banner
    if (lastAcknowledgedActivityId && lastAcknowledgedActivityId === activity.id) {
      shouldDisplayNewMessageMarker = true;
    }
  });

  return (
    <div className={classNames(`activity-list`)}>
      {items}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array,
  avatars: PropTypes.object.isRequired,
  currentUserId: PropTypes.string,
  flags: PropTypes.array,
  lastAcknowledgedActivityId: PropTypes.string,
  onActivityDelete: PropTypes.func.isRequired,
  onActivityFlag: PropTypes.func.isRequired
};
