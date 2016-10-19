/* eslint-disable react/no-set-state */
import React, {Component} from 'react';
import classNames from 'classnames';

import styles from './styles/loader.css';

function getDisplayName(C) {
  return C.displayName || C.name || `C`;
}

export default function injectWidgetLoader(WrappedComponent) {
  class WidgetLoader extends Component {

    constructor(props) {
      super(props);
      this.handleSubmit = this.handleSubmit.bind(this);
      this.handleFieldChange = this.handleFieldChange.bind(this);
    }

    shouldComponentUpdate() {
      return true;
    }

    getComponentProps(component) {
      return component.propTypes;
    }

    handleFieldChange(e) {
      this.setState({tempUserId: e.target.value});
    }

    handleSubmit(e) {
      e.preventDefault();
      const count = this.state.renderKey || 1;
      this.setState(Object.assign({}, {
        userId: this.state.tempUserId,
        renderKey: count + 1
      }));
    }

    render() {
      let widget;
      const props = this.props;
      if (this.state && this.state.userId) {
        widget = <div className={classNames(`widget-component-container`, styles.widgetComponentContainer)} key={`widget-${this.state.renderKey}`}><WrappedComponent accessToken={props.accessToken} userId={this.state.userId} /></div>;
      }
      return (
        <div className={classNames(`widget-container`, styles.widgetContainer)}>
          <form className={classNames(`widget-props-form`, styles.widgetPropsForm)} ref={this.getForm}>
            <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
              <label className={classNames(`field-label`, styles.fieldLabel)}>User ID</label>
              <input
                className={classNames(`field-input`, styles.fieldInput)}
                onChange={this.handleFieldChange}
                type="text"
                value={this.state ? this.state.tempUserId : ``}
              />
            </div>
            <button className={classNames(`props-submit`, styles.propsSubmit)} onClick={this.handleSubmit}>Go</button>
          </form>
          {widget}
        </div>
      );
    }
  }

  WidgetLoader.displayName = `WidgetLoader(${getDisplayName(WrappedComponent)})`;
  WidgetLoader.WrappedComponent = WrappedComponent;

  return WidgetLoader;
}
