import React from 'react';

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
      <h1>Chat Widget!</h1>
    );
  }
}
