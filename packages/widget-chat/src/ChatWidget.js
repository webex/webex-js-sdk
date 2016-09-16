import React from 'react';

/**
 * ChatWidget Component
 *
 * @export
 * @class ChatWidget
 * @extends {React.Component}
 */
export default class ChatWidget extends React.Component {

  /**
   * Creates an instance of ChatWidget.
   *
   * @param {any} props
   *
   */
  constructor(props) {
    super(props);

    this.name = `ChatWidget`;
  }

  /**
   * Render
   *
   * @returns {Object}
   *
   * @memberOf ChatWidget
   */
  render() {
    return (
      <h1>Chat Widget!</h1>
    );
  }
}
