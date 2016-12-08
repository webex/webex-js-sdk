import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import {constructFiles} from '../../utils/files';
import {addFiles, removeFile} from '../../actions/activity';

import AddFileButton from '../../components/add-file-button';
import FileStagingArea from '../../components/file-staging-area';
import styles from './styles.css';

export class FileUploader extends Component {

  constructor(props) {
    super(props);
    this.handleFileChange = this.handleFileChange.bind(this);
    this.handleFileRemove = this.handleFileRemove.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.activity !== props.activity;
  }

  handleFileChange(e) {
    e.stopPropagation();
    e.preventDefault();

    if (e.target.files.length) {
      const props = this.props;

      const {
        activity,
        conversation,
        spark
      } = props;

      const files = constructFiles(e.target.files);
      props.addFiles(conversation, activity, files, spark);

      // Clear the value of the input so the same file can be added again.
      e.target.value = ``;
    }
  }

  handleFileRemove(id) {
    const props = this.props;
    props.removeFile(id, props.activity);
  }

  render() {
    const props = this.props;
    const {
      onSubmit
    } = this.props;
    const files = props.activity.get(`files`);

    let stagingArea;
    if (files && files.count()) {
      stagingArea = ( // eslint-disable-line no-extra-parens
        <FileStagingArea
          files={files}
          onFileRemove={this.handleFileRemove}
          onSubmit={onSubmit}
        />
      );
    }

    return (
      <div className={classNames(`file-uploader-container`, styles.container)}>
        {stagingArea}
        <div className={classNames(`button-container`, styles.buttonContainer)}>
          <AddFileButton onChange={this.handleFileChange} />
        </div>
      </div>
    );
  }
}

FileUploader.propTypes = {
  onSubmit: PropTypes.func
};

export default connect(
  (state) => ({
    activity: state.activity,
    conversation: state.conversation,
    spark: state.spark.get(`spark`)
  }),
  (dispatch) => bindActionCreators({
    addFiles,
    removeFile
  }, dispatch)
)(FileUploader);
