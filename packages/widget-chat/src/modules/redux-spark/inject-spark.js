import React, {Component, PropTypes} from 'react';

import SparkComponent from './component';

function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}

export default function injectSpark(WrappedComponent, options = {}) {
  const {
    withRef = false
  } = options;

  class InjectSpark extends Component {

    shouldComponentUpdate(nextProps) {
      return nextProps !== this.props;
    }

    getWrappedInstance() {
      // eslint-disable-next-line react/no-string-refs
      return this.refs.wrappedInstance;
    }

    render() {
      return (
        <div>
          <SparkComponent accessToken={this.props.accessToken} />
          <WrappedComponent
            {...this.props}
            ref={withRef ? `wrappedInstance` : null}
          />
        </div>
      );
    }
  }

  InjectSpark.propTypes = {
    accessToken: PropTypes.string
  };

  InjectSpark.displayName = `InjectSpark(${getDisplayName(WrappedComponent)})`;
  InjectSpark.WrappedComponent = WrappedComponent;

  return InjectSpark;
}
