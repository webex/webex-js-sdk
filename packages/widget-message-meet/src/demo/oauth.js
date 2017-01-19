/* eslint-disable react/no-set-state, camelcase */
import {Component, PropTypes} from 'react';
import '@ciscospark/plugin-encryption';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';
import Spark from '@ciscospark/spark-core';


class SparkOAuth extends Component {
  componentDidMount() {
    this.spark = new Spark({
      config: {
        credentials: {
          oauth: {
            client_id: this.props.clientId,
            client_secret: this.props.clientSecret,
            scope: this.props.scope,
            redirect_uri: this.props.redirectUri
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
  clientId: PropTypes.string,
  clientSecret: PropTypes.string,
  doAuth: PropTypes.bool,
  onAuth: PropTypes.func,
  redirectUri: PropTypes.string,
  scope: PropTypes.string
};

SparkOAuth.defaultProps = {
  doAuth: false
};

export default SparkOAuth;
