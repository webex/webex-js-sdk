import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import {
  createActivity,
  submitActivity,
  updateActivityText
} from '../../actions/activity';
import TextArea from '../../components/textarea';
import AddFileButton from '../../components/add-file-button';

import styles from './styles.css';

export class MessageComposer extends Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.activity) {
      const props = this.props;
      props.createActivity(props.conversation, ``, props.conversation.participants[0]);
    }
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return props.activity !== nextProps.activity;
  }

  handleChange(e) {
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
    const {props} = this;
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
    if (props.activity && props.activity.object) {
      text = props.activity.object.displayName;
    }
    const {placeholder} = this.props;

    return (
      <div className={classNames(`message-composer`, styles.messageComposer)}>
        <div className={classNames(`add-file-container`, styles.addFileContainer)}>
          <AddFileButton />
        </div>
        <div className={classNames(`textarea-container`)}>
          <TextArea
            onChange={this.handleChange}
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
  return Object.assign({}, state.activity, {
    spark: ownProps.spark,
    conversation: state.conversation
  });
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    createActivity,
    submitActivity,
    updateActivityText
  }, dispatch)
)(MessageComposer);
