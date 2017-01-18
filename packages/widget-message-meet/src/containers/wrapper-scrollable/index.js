import React, {Component, PropTypes} from 'react';

import styles from './styles.css';


function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}

export default function injectScrollable(WrappedComponent) {
  class ScrollableComponent extends Component {
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

    getScrollHeight() {
      return this.node.scrollHeight;
    }

    getScrollTop() {
      return this.node.scrollTop;
    }

    setScrollTop(top) {
      this.node.scrollTop = top;
    }

    scrollToBottom() {
      const node = this.node;
      node.scrollTop = node.scrollHeight;
    }

    isScrolledToTop() {
      return this.node.scrollTop < 100;
    }

    isScrolledToBottom() {
      const node = this.node;
      return node.scrollHeight - node.offsetHeight - node.scrollTop < 150;
    }

    render() {
      return (
        <div className={styles.scrollable} onScroll={this.props.onScroll} ref={this.getNode}>
          <WrappedComponent {...this.props} />
        </div>
      );
    }
  }

  ScrollableComponent.propTypes = {
    onScroll: PropTypes.func
  };

  ScrollableComponent.displayName = `ScrollableComponent(${getDisplayName(WrappedComponent)})`;
  ScrollableComponent.WrappedComponent = WrappedComponent;

  return ScrollableComponent;
}
