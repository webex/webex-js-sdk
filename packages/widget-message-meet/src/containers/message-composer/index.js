import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';
import _ from 'lodash';

import {
  setUserTyping,
  submitActivity,
  updateActivityText
} from '../../actions/activity';
import {blurTextArea, focusTextArea} from '../../actions/widget';

import FileUploader from '../file-uploader';
import TextArea from '../../components/textarea';


import styles from './styles.css';

// milliseconds before repeating a 'is typing' status
const TYPING_DELAY = 150;

export class MessageComposer extends Component {
  constructor(props) {
    super(props);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleTextAreaBlur = this.handleTextAreaBlur.bind(this);
    this.handleTextAreaFocus = this.handleTextAreaFocus.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.debouncedTyping = _.debounce(
      this.sendTyping,
      TYPING_DELAY,
      {
        leading: true,
        maxWait: 350,
        trailing: false
      }
    );
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return props.activity !== nextProps.activity || props.widget !== nextProps.widget;
  }

  handleTextChange(e) {
    const props = this.props;
    props.updateActivityText(e.target.value);
    if (e.target.value === ``) {
      const {
        conversation,
        spark
      } = props;
      props.setUserTyping(false, conversation, spark);
    }
  }

  handleKeyDown(e) {
    if (e.keyCode === 13 && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      this.handleSubmit();
      e.preventDefault();
    }
    else {
      const props = this.props;
      this.debouncedTyping(props);
    }
  }

  handleSubmit() {
    const props = this.props;
    const {
      activity,
      conversation,
      spark,
      user
    } = props;
    const {onSubmit} = this.props;
    props.submitActivity(conversation, activity, user.currentUser, spark);
    if (onSubmit) {
      onSubmit();
    }
  }

  handleTextAreaBlur() {
    const props = this.props;
    const {
      conversation,
      spark
    } = props;
    props.blurTextArea();
    this.debouncedTyping.cancel();
    props.setUserTyping(false, conversation, spark);
  }

  handleTextAreaFocus() {
    const props = this.props;
    props.focusTextArea();
  }

  sendTyping(props) {
    const {
      conversation,
      spark
    } = props;
    props.setUserTyping(true, conversation, spark);
  }

  render() {
    let text;
    const props = this.props;
    if (props.activity && props.activity.has(`text`)) {
      text = props.activity.get(`text`);
    }
    const {placeholder} = this.props;
    const textAreaFocusStyle = props.widget.hasTextAreaFocus ? styles.hasFocus : ``;

    return (
      <div className={classNames(`message-composer`, styles.messageComposer, textAreaFocusStyle)}>
        <FileUploader onSubmit={this.handleSubmit} />
        <div className={classNames(`textarea-container`, styles.textareaContainer)}>
          <TextArea
            onBlur={this.handleTextAreaBlur}
            onChange={this.handleTextChange}
            onFocus={this.handleTextAreaFocus}
            onKeyDown={this.handleKeyDown}
            onSubmit={this.handleSubmit}
            placeholder={placeholder}
            rows={1}
            textAreaClassName={styles.textarea}
            value={text}
          />
        </div>
      </div>
    );
  }
}

MessageComposer.propTypes = {
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string
};

function mapStateToProps(state, ownProps) {
  return {
    activity: state.activity,
    spark: ownProps.spark,
    conversation: state.conversation,
    widget: state.widget,
    user: state.user
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    blurTextArea,
    focusTextArea,
    setUserTyping,
    submitActivity,
    updateActivityText
  }, dispatch)
)(MessageComposer);
