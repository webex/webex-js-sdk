import React, {Component} from 'react';
import spark from './spark';

import SparkComponent from './component.js';

function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}

export default function injectSpark(WrappedComponent, options = {}) {
  const {
    withRef = false
  } = options;

  class InjectSpark extends Component {
    getWrappedInstance() {
      // TODO find a way to do this that doesn't require a deprecated API
      // eslint-disable-next-line react/no-string-refs
      return this.refs.wrappedInstance;
    }

    render() {
      return (
        <div>
          <SparkComponent spark={spark} />
          <WrappedComponent
            {...this.props}
            ref={withRef ? `wrappedInstance` : null}
            spark={spark}
          />
        </div>
      );
    }
  }

  InjectSpark.displayName = `InjectSpark(${getDisplayName(WrappedComponent)})`;
  InjectSpark.WrappedComponent = WrappedComponent;

  return InjectSpark;
}
