import React, {Component} from 'react';
import {Alert, Button} from 'react-bootstrap';

export default class IncomingCallAlert extends Component {
  static propTypes = {
    call: React.PropTypes.object.isRequired,
    onAnswer: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    spark: React.PropTypes.object.isRequired
  };

  handleAnswer() {
    const {spark, call, onAnswer} = this.props;
    onAnswer(spark, call);
  }

  handleAnswerWithAudio() {
    const {spark, call, onAnswer} = this.props;
    onAnswer(spark, call, {audio: true, video: false});
  }

  handleAnswerWithVideo() {
    const {spark, call, onAnswer} = this.props;
    onAnswer(spark, call, {audio: false, video: true});
  }

  handleDecline() {
    const {call, onDecline} = this.props;
    onDecline(call);
  }

  render() {
    const {call} = this.props;
    // TODO pass remote name from connect, don't read it from the call object
    const remoteName = call.remote.person.name;
    return (
      <Alert bsStyle="warning" onDismiss={this.handleDecline.bind(this)}>
        <p><strong>Incoming Call</strong> from {remoteName}</p>
        <p>
          <Button onClick={this.handleAnswer.bind(this)} title="Answer Call">Answer</Button>
          <Button onClick={this.handleAnswerWithAudio.bind(this)} title="Answer Call with Audio">Answer with Audio</Button>
          <Button onClick={this.handleAnswerWithVideo.bind(this)} title="Answer Call with Video">Answer with Video</Button>
          <Button bsStyle="danger" onClick={this.handleDecline.bind(this)} title="Decline Call">Decline</Button>
        </p>
      </Alert>
    );
  }
}
