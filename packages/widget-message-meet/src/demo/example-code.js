import React, {PropTypes} from 'react';

import classNames from 'classnames';

import styles from './example-code.css';

export const MODE_REACT = `MODE_REACT`;
export const MODE_INLINE = `MODE_INLINE`;

function ExampleCode(props) {
  let code;
  let label;
  if (props.type === MODE_REACT) {
    label = `React Component Example`;
    code = `<MessageMeetWidget accessToken="${props.accessToken}" toPersonEmail="${props.toPersonEmail}" />`;
  }
  else if (props.type === MODE_INLINE) {
    label = `Inline Container Example`;
    code = `<div data-toggle="spark-message-meet" data-access-token="${props.accessToken}" data-to-person-email="${props.toPersonEmail}" />`;
  }
  return (
    <div>
      <div className={classNames(`display`, styles.display)}>{label}</div>
      <div className={classNames(`code`, styles.code)}>
        <pre>
          {code}
        </pre>
      </div>
    </div>
  );
}

ExampleCode.propTypes = {
  accessToken: PropTypes.string,
  toPersonEmail: PropTypes.string,
  type: PropTypes.string.isRequired
};

ExampleCode.defaultProps = {
  accessToken: `YOUR_ACCESS_TOKEN`,
  toPersonEmail: `TARGET_USER_EMAIL`
};

export default ExampleCode;
