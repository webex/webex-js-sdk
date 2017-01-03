/* eslint-disable react/no-set-state */
import React, {Component} from 'react';
import '@ciscospark/plugin-encryption';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';
import Spark from '@ciscospark/spark-core';


class SparkOAuth extends Component {
  constructor(props) {
    super(props);
    this.state = {
      accessToken: undefined
    };

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

    //TODO REMOVE FOR RELEASE
    window.spark = this.spark;
    this.spark.on(`loaded`, () => {
      this.checkForOauthToken();
    });
    // this.spark.listenToAndRun(this.spark, `change:canAuthorize`, () => {
    //   this.checkForOauthToken();
    // });

    this.handleClick = this.handleClick.bind(this);
  }

  shouldComponentUpdate() {
    return false;
  }

  handleClick(e) {
    e.preventDefault();
    this.spark.authenticate();
  }

  checkForOauthToken() {
    if (this.spark.credentials.authorization && this.spark.credentials.authorization.access_token) {
      const token = this.spark.credentials.authorization.access_token;
      this.setState({accessToken: token});
    }
  }


  render() {
    return (
      <div>
        <button onClick={this.handleClick}>{`Oauth`}</button>
        <div>{`Token: ${this.state.accessToken}`}</div>
      </div>
    );
  }
}

export default SparkOAuth;
