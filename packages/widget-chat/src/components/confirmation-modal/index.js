import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ConfirmationModal(props) {
  const {
    messages
  } = props;

  const modalClassNames = classNames(`dialogue-modal`, styles.dialogueModal);

  const actionBtnClassNames = classNames(
    `dialogue-modal-btn`,
    `dialogue-modal-action-btn`,
    styles.dialogueModalBtn,
    styles.dialogueModalActionBtn
  );
  const cancelBtnClassNames = classNames(
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
            className={actionBtnClassNames}
            onClick={props.onClickActionButton}
            title={messages.actionButtonText}
          >
            {messages.actionButtonText}
          </button>
          <button
            className={cancelBtnClassNames}
            onClick={props.onClickCancelButton}
            title={messages.cancelButtonText}
          >
            {messages.cancelButtonText}
          </button>
        </div>
      </div>
      <div className={classNames(`dialogue-modal-backdrop`, styles.dialogueModalBackdrop)} />
    </div>
  );

}

ConfirmationModal.propTypes = {
  messages: PropTypes.object,
  onClickActionButton: PropTypes.func,
  onClickCancelButton: PropTypes.func
};
