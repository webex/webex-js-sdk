import React, {Component} from 'react';
import {Button, ButtonGroup, FormControl, FormGroup} from 'react-bootstrap';
import Form from '../form';

export default class Dialer extends Component {
  static propTypes = {
    onDial: React.PropTypes.func.isRequired,
    spark: React.PropTypes.object.isRequired
  };

  handleSubmit(values) {
    const {onDial, spark} = this.props;
    onDial(spark, values.address);
  }

  handleAudioOnlyClicked(event) {
    event.preventDefault();
    const {onDial, spark} = this.props;
    onDial(spark, this.form.state.address, {
      video: false
    });
  }

  handleVideoOnlyClicked(event) {
    event.preventDefault();
    const {onDial, spark} = this.props;
    onDial(spark, this.form.state.address, {
      audio: false
    });
  }

  render() {
    return (
      <Form className="form-inline" onSubmit={this.handleSubmit.bind(this)} ref={(f) => {this.form = f;}}>
        <FormGroup controlId="Address">
          <FormControl
            name="address"
            placeholder="Enter email address"
            required
            title="Enter email address"
            type="text"
          />
        </FormGroup>
        <ButtonGroup>
          <Button title="Dial" type="submit">Dial</Button>
          <Button onClick={this.handleAudioOnlyClicked.bind(this)} title="Dial (Audio Only)" type="submit">Dial (Audio Only)</Button>
          <Button onClick={this.handleVideoOnlyClicked.bind(this)} title="Dial (Video Only)" type="submit">Dial (Video Only)</Button>
        </ButtonGroup>
      </Form>
    );
  }
}
