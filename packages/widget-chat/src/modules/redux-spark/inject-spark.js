import React, {Component} from 'react';
import spark from './spark';

import SparkComponent from './component.js';

export default function injectSpark(WrappedComponent) {

  class InjectSpark extends Component {
    render() {
      return (
        <div>
          <SparkComponent spark={spark} />
          <WrappedComponent
            {...this.props}
            spark={spark}
          />
        </div>
      );
    }
  }
  return InjectSpark;
}
