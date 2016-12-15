/* eslint-disable react/no-set-state, global-require */
import React, {Component, PropTypes} from 'react';

import Root from './root';
import WidgetDataInput from './components/widget-data-input';

class Main extends Component {

  constructor(props) {
    super(props);
    const {accessToken, toPersonEmail, toPersonId} = props;
    this.state = {
      accessToken,
      toPersonEmail,
      toPersonId
    };
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  shouldComponentUpdate() {
    return true;
  }

  getComponentProps(component) {
    return component.propTypes;
  }

  handleSubmit(data) {
    this.setState(data);
  }

  render() {
    const {state} = this;
    let display;
    if (state.accessToken && state.toPersonId || state.accessToken && state.toPersonEmail) {
      display = <Root accessToken={state.accessToken} toPersonEmail={state.toPersonEmail} toPersonId={state.toPersonId} />;
    }
    else {
      // eslint-disable-next-line no-extra-parens
      display = (
        <WidgetDataInput
          accessToken={state.accessToken}
          onSubmit={this.handleSubmit}
          toPersonEmail={state.toPersonEmail}
          toPersonId={state.toPersonId}
        />);
    }
    return (
      <div>
        {display}
      </div>
    );
  }
}

Main.propTypes = {
  accessToken: PropTypes.string,
  toPersonEmail: PropTypes.string,
  toPersonId: PropTypes.string
};

export default Main;
