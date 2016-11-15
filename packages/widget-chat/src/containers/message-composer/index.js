import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import {setMessage, submitMessage} from '../../actions/message';
import TextArea from '../../components/textarea';
import AddFileButton from '../../components/add-file-button';

import styles from './styles.css';

// eslint-disable-reason Redux connect gives us shouldComponentUpdate smarts
export class MessageComposer extends Component { // eslint-disable-line react/require-optimization
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  handleChange(e) {
    const props = this.props;
    props.setMessage(e.target.value);
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
      conversation,
      spark,
      value
    } = props;
    const {onSubmit} = this.props;
    props.submitMessage(conversation, value, spark);
    if (onSubmit) {
      onSubmit();
    }
  }

  render() {
    const props = this.props;
    const {
      value
    } = props;
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
            value={value}
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
  return Object.assign({}, state.message, {
    spark: ownProps.spark,
    conversation: state.conversation,
    value: state.message.value
  });
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    setMessage,
    submitMessage
  }, dispatch)
)(MessageComposer);
