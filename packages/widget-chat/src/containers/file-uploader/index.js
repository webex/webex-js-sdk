import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import {constructFile} from '../../utils/files';
import {addFiles} from '../../actions/activity';

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

  handleFileChange(e) {
    e.stopPropagation();
    e.preventDefault();

    const props = this.props;

    const {
      activity,
      conversation,
      spark
    } = props;

    const files = [];

    for (let i = 0; i < e.target.files.length; i++) {
      files.push(constructFile(e.target.files[i]));
    }
    props.addFiles(conversation, activity, files, spark);

    // Clear the value of the input so the same file can be added again.
    e.target.value = ``;
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
    activity: state.activity,
    conversation: state.conversation,
    spark: state.spark.get(`spark`)
  }),
  (dispatch) => bindActionCreators({
    addFiles
  }, dispatch)
)(FileUploader);
