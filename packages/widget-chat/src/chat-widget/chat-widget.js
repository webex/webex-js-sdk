import React from 'react';
import classNames from 'classnames';

import styles from './styles.css';

/**
 * ChatWidget Component
 *
 * @export
 * @class ChatWidget
 * @extends {React.Component}
 */
export default class ChatWidget extends React.Component {

  /**
   * Render
   *
   * @returns {Object}
   *
   * @memberOf ChatWidget
   */
  render() {
    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        <h1>Chat Widget!</h1>
      </div>
    );
  }
}
