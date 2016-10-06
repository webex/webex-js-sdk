import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import {setMessage, submitMessage} from '../../actions/message';
import TextArea from '../../components/textarea';

import styles from './styles.css';

class MessageComposer extends Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return props.value !== nextProps.value;
  }

  handleChange(e) {
    this.props.setMessage(e.target.value);
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
      conversation,
      spark,
      value
    } = props;
    props.submitMessage(conversation, value, spark);
  }

  render() {
    const props = this.props;
    const {
      placeholder,
      value
    } = props;

    return (
      <div className={classNames(`message-composer`, styles.messageComposer)}>
        <TextArea
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          onSubmit={this.handleSubmit}
          placeholder={placeholder}
          value={value}
        />
      </div>
    );
  }
}

MessageComposer.propTypes = {
  placeholder: PropTypes.string,
  setMessage: PropTypes.func.isRequired,
  submitMessage: PropTypes.func.isRequired
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
