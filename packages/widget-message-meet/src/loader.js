/* eslint-disable react/no-set-state, global-require */
import React, {Component} from 'react';
import classNames from 'classnames';

import styles from './styles/loader.css';
let bgImg;
try {
  bgImg = require(`./local/bg.png`);
}
catch (e) {
  bgImg = require(`./images/bg.png`);
}

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
      this.setState(Object.assign({}, {
        userId: this.state.tempUserId
      }));
    }

    render() {
      let widget;
      const props = this.props;
      if (this.state && this.state.userId) {
        widget = ( // eslint-disable-line no-extra-parens
          <div className={classNames(`widget-component-container`, styles.widgetComponentContainer)} >
            <WrappedComponent accessToken={props.accessToken} userId={this.state.userId} />
          </div>
        );
      }
      else {
        widget = ( // eslint-disable-line no-extra-parens
          <form className={classNames(`widget-props-form`, styles.widgetPropsForm)} ref={this.getForm}>
            <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
              <input
                className={classNames(`field-input`, styles.fieldInput)}
                onChange={this.handleFieldChange}
                placeholder="User ID"
                type="text"
                value={this.state ? this.state.tempUserId : ``}
              />
            </div>
            <button className={classNames(`props-submit`, styles.propsSubmit)} onClick={this.handleSubmit}>{`Chat`}</button>
          </form>
        );
      }
      return (
        <div className={classNames(`widget-container`, styles.widgetContainer)} style={{backgroundImage: `url('${bgImg}')`}}>
          {widget}
        </div>
      );
    }
  }

  WidgetLoader.displayName = `WidgetLoader(${getDisplayName(WrappedComponent)})`;
  WidgetLoader.WrappedComponent = WrappedComponent;

  return WidgetLoader;
}
