import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ConfirmationModal(props) {
  const {
    messages
  } = props;

  const modalClassNames = classNames(`dialogue-modal`, styles.dialogueModal);

  const leftBtnClassNames = classNames(
    `dialogue-modal-btn`,
    `dialogue-modal-action-btn`,
    styles.dialogueModalBtn,
    styles.dialogueModalActionBtn
  );
  const rightBtnClassNames = classNames(
    `dialogue-modal-btn`,
    `dialogue-modal-exit-btn`,
    styles.dialogueModalBtn,
    styles.dialogueModalExitBtn
  );



  return (
    <div>
      <div className={modalClassNames}>
        <div className={classNames(`dialogue-modal-body`, styles.dialogModalBody)}>
          <div className={classNames(`dialogue-modal-title-text`, styles.dialogueModalTitleText)}>
            {messages.title}
          </div>
          <div className={classNames(`dialogue-modal-body-subtext`, styles.dialogueModalBodySubtext)}>
            {messages.body}
          </div>
          <button
            className={leftBtnClassNames}
            onClick={props.onClickLeftBtn}
            title={messages.leftBtnText}
          >
            {messages.leftBtnText}
          </button>
          <button
            className={rightBtnClassNames}
            onClick={props.onClickRightBtn}
            title={messages.rightBtnText}
          >
            {messages.rightBtnText}
          </button>
        </div>
      </div>
      <div className={classNames(`dialogue-modal-backdrop`, styles.dialogueModalBackdrop)} />
    </div>
  );

}

ConfirmationModal.propTypes = {
  messages: PropTypes.object,
  onClickLeftBtn: PropTypes.func,
  onClickRightBtn: PropTypes.func
};
