import React, {Component} from 'react';

import styles from './styles.css';

function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}

export default function scrollableComponent(WrappedComponent) {
  class InjectScrollable extends Component {
    constructor(props) {
      super(props);
      this.getNode = this.getNode.bind(this);
    }

    shouldComponentUpdate(nextProps) {
      return nextProps !== this.props;
    }

    getNode(node) {
      this.node = node;
    }

    scrollToBottom() {
      const node = this.node;
      node.scrollTop = node.scrollHeight;
    }

    render() {
      return <div className={styles.scrollable} ref={this.getNode}><WrappedComponent {...this.props} /></div>;
    }
  }

  InjectScrollable.displayName = `InjectScrollable(${getDisplayName(WrappedComponent)})`;
  InjectScrollable.WrappedComponent = WrappedComponent;

  return InjectScrollable;
}
