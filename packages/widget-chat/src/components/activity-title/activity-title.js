import React from 'react';
import classNames from 'classnames';

import styles from './styles.css';


export default class ActivityTitle extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      heading: props.heading
    };
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <div className={classNames(`activity-title`, styles.activityTitle)}>
        <h2>{this.state.heading}</h2>
      </div>
    );
  }
}

ActivityTitle.propTypes = {
  heading: React.PropTypes.string.isRequired
};
