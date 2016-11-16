import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import spark from '../../modules/redux-spark/spark';
import {constructFile} from '../../utils/files';
import {addShareFiles} from '../../actions/activity';

import AddFileButton from '../../components/add-file-button';
import styles from './styles.css';

export class FileUploader extends Component {

  constructor(props) {
    super(props);
    this.handleFileChange = this.handleFileChange.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.activity === props.activity;
  }

  getFiles() {
    const props = this.props;
    return props.activity.files;
  }

  handleFileChange(e) {
    e.stopPropagation();
    e.preventDefault();

    const props = this.props;

    const {
      activity,
      conversation
    } = props;

    const files = [];

    for (let i = 0; i < e.target.files.length; i++) {
      files.push(constructFile(e.target.files[i]));
    }
    props.addShareFiles(conversation, activity, files, spark);

    // Clear the value of the input so the same file can be added again.
    e.target.value = ``;
  }

  uploadFiles(files) {
    return files;
  }

  render() {
    return (
      <div className={classNames(`file-uploader-container`, styles.container)}>
        <div className={classNames(`button-container`, styles.buttonContainer)}>
          <AddFileButton onChange={this.handleFileChange} />
        </div>
      </div>
    );
  }
}

FileUploader.propTypes = {
  handleSubmit: PropTypes.func
};


export default connect(
  (state) => ({
    activity: state.activity.activity,
    conversation: state.conversation
  }),
  (dispatch) => bindActionCreators({
    addShareFiles
  }, dispatch)
)(FileUploader);
