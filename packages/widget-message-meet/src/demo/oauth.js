/* eslint-disable react/no-set-state, camelcase */
import {Component, PropTypes} from 'react';
import '@ciscospark/plugin-encryption';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';
import Spark from '@ciscospark/spark-core';


class SparkOAuth extends Component {
  componentDidMount() {
    const l = window.location;
    const redirectUri = `${l.protocol}//${l.host}${l.pathname}`.replace(/\/$/, ``);
    this.spark = new Spark({
      config: {
        credentials: {
          oauth: {
            client_id: `C6acec3fac30d32ed481f3592d4b96ea9a55214f91cc285486ab0d1fe26d180ad`,
            client_secret: `eed978411377926971722de5c4d7b11b625df01137eec9a51c6a92d62acedfc3`,
            scope: `spark:kms spark:rooms_read spark:rooms_write spark:memberships_read spark:memberships_write spark:messages_read spark:messages_write`,
            redirect_uri: redirectUri
          }
        },
        storage: {
          boundedAdapter: new LocalStorageStoreAdapter(`ciscospark-embedded`)
        }
      }
    });

    this.spark.listenToAndRun(this.spark, `change:canAuthorize`, () => {
      this.checkForOauthToken();
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.doAuth && nextProps.doAuth !== this.props.doAuth) {
      this.spark.authenticate();
    }
  }

  shouldComponentUpdate() {
    return false;
  }

  checkForOauthToken() {
    const {credentials} = this.spark;
    if (credentials.canAuthorize && credentials.supertoken) {
      const {supertoken} = credentials;
      this.props.onAuth(supertoken.access_token);
    }
  }

  render() {
    return null;
  }
}

SparkOAuth.propTypes = {
  doAuth: PropTypes.bool,
  onAuth: PropTypes.func
};

SparkOAuth.defaultProps = {
  doAuth: false
};

export default SparkOAuth;
