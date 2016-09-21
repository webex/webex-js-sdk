import React from 'react';
import classNames from 'classnames';

import ActivityTitle from '../components/activity-title/activity-title';

import styles from './styles.css';

/**
 * ChatWidget Component
 */
export default class ChatWidget extends React.Component {
  /**
   * Never update since we're not using any props yet
   *
   * @returns {Boolean}
   */
  shouldComponentUpdate() {
    return false;
  }

  /**
   * Render
   *
   * @returns {Object}
   */
  render() {
    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        <ActivityTitle heading="Chat Widget!" />
      </div>
    );
  }
}
