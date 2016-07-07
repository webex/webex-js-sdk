import React, {Component} from 'react';
import {Button, ButtonToolbar} from 'react-bootstrap';

export default class CallListItem extends Component {
  static propTypes = {
    call: React.PropTypes.object.isRequired,
    onAnswer: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired
  }

  handleAnswer() {
    const {call, onAnswer} = this.props;
    onAnswer(call);
  }

  handleDecline() {
    const {call, onDecline} = this.props;
    onDecline(call);
  }

  render() {
    const remoteName = this.props.call.remote.person.name;
    return (
      <div>
        <p>{remoteName}</p>
        <ButtonToolbar>
          <Button onClick={this.handleDecline.bind(this)} title="Decline Call">decline</Button>
          <Button onClick={this.handleAnswer.bind(this)} title="Answer Call">answer</Button>
        </ButtonToolbar>
      </div>
    );
  }
}
