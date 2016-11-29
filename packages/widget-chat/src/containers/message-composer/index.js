import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import {
  submitActivity,
  updateActivityText
} from '../../actions/activity';
import FileUploader from '../file-uploader';
import TextArea from '../../components/textarea';


import styles from './styles.css';

export class MessageComposer extends Component {
  constructor(props) {
    super(props);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return props.activity !== nextProps.activity;
  }

  handleTextChange(e) {
    const props = this.props;
    props.updateActivityText(e.target.value);
  }

  handleKeyDown(e) {
    if (e.keyCode === 13 && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      this.handleSubmit();
      e.preventDefault();
    }
  }

  handleSubmit() {
    const props = this.props;
    const {
      activity,
      conversation,
      spark
    } = props;
    const {onSubmit} = this.props;
    props.submitActivity(conversation, activity, spark);
    if (onSubmit) {
      onSubmit();
    }
  }

  render() {
    let text;
    const props = this.props;
    if (props.activity && props.activity.has(`text`)) {
      text = props.activity.get(`text`);
    }
    const {placeholder} = this.props;

    return (
      <div className={classNames(`message-composer`, styles.messageComposer)}>
        <FileUploader onSubmit={this.handleSubmit} />
        <div className={classNames(`textarea-container`, styles.textareaContainer)}>
          <TextArea
            onChange={this.handleTextChange}
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
    conversation: state.conversation
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    submitActivity,
    updateActivityText
  }, dispatch)
)(MessageComposer);
