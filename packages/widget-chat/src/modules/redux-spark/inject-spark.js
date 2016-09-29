import React, {Component} from 'react';

import createSpark from './spark';
import SparkComponent from './component';


function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}


export default function injectSpark(WrappedComponent, options = {}) {
  const {
    withRef = false
  } = options;
  const spark = createSpark();

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
