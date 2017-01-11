import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';
import DaySeparator from '../day-separator';
import NewMessagesSeparator from '../new-messages-separator';
import formatDate from '../../utils/date';

export const ITEM_TYPE_ACTIVITY = `ITEM_TYPE_ACITIVITY`;
export const ITEM_TYPE_DAY_SEPARATOR = `ITEM_TYPE_DAY_SEPARATOR`;
export const ITEM_TYPE_NEW_MESSAGE_SEPARATOR = `ITEM_TYPE_NEW_MESSAGE_SEPARATOR`;

export default function ActivityList(props) {
  const {activities, onActivityDelete, onActivityFlag} = props;
  const items = activities.map((visibleActivity) => {
    switch (visibleActivity.type) {
    case ITEM_TYPE_DAY_SEPARATOR: {
      const {fromDate, key, now, toDate} = visibleActivity;
      return (
        <DaySeparator
          fromDate={fromDate}
          key={key}
          now={now}
          toDate={toDate}
        />
      );
    }
    case ITEM_TYPE_ACTIVITY: {
      const {activity, avatarUrl, isPending, isAdditional, isFlagged, isSelf} = visibleActivity;
      return (
        <ActivityItem
          activity={activity.object}
          avatarUrl={avatarUrl}
          id={activity.id}
          isAdditional={isAdditional}
          isFlagged={isFlagged}
          isPending={isPending}
          isSelf={isSelf}
          key={activity.id}
          name={activity.actor.displayName}
          onActivityDelete={onActivityDelete}
          onActivityFlag={onActivityFlag}
          timestamp={formatDate(activity.published)}
          verb={activity.verb}
        />
      );
    }
    case ITEM_TYPE_NEW_MESSAGE_SEPARATOR: {
      return <NewMessagesSeparator key={visibleActivity.key} />;
    }
    default: {
      return ``;
    }
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
  onActivityDelete: PropTypes.func.isRequired,
  onActivityFlag: PropTypes.func.isRequired
};
