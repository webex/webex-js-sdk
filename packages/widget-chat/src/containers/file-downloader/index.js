import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import spark from '../../modules/redux-spark/spark';
import {downloadSharedFile} from '../../actions/share';


function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}

export default function injectFileDownloader(WrappedComponent) {
  class FileDownloader extends Component {
    constructor(props) {
      super(props);
      this.downloadFile = this.downloadFile.bind(this);
      this.getSharedFile = this.getSharedFile.bind(this);
    }

    componentDidMount() {
      const {files} = this.props;
      files.forEach((file) => {
        if (file.url && file.scr && !this.getSharedFile(file.url)) {
          this.downloadFile(file);
        }
      });
    }

    downloadFile(file) {
      const props = this.props;
      props.downloadSharedFile(file, spark);
    }

    getSharedFile(fileUrl) {
      const props = this.props;
      return props.share.files[fileUrl];
    }

    render() {
      const {
        files
      } = this.props;

      const content = files.map((file) => {
        if (file.url && file.scr) {
          const filePointer = this.getSharedFile(file.url);
          if (filePointer && !filePointer.isDownloading) {
            return <div key={file.url}>{file.displayName} - {file.url} <img src={filePointer.objectUrl} /></div>;
          }
        }
        return <div key={file.url}>{file.displayName} - {file.url}</div>;
      });

      return (
        <div>
          <WrappedComponent content={content} {...this.props} />
        </div>
      );
    }
  }

  FileDownloader.propTypes = {
    files: PropTypes.array
  };

  FileDownloader.displayName = `FileDownloader(${getDisplayName(WrappedComponent)})`;
  FileDownloader.WrappedComponent = WrappedComponent;

  return connect(
    (state) => ({
      share: state.share
    }),
    (dispatch) => bindActionCreators({
      downloadSharedFile
    }, dispatch)
  )(FileDownloader);
}
