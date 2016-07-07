import React from 'react';
import {
  Button,
  Checkbox,
  FormControl,
  FormGroup,
  Radio
} from 'react-bootstrap';
import Form from '../form';

// FIXME <Form /> doesn't set default values
export default function RateDialog({onRate, onSkip}) {
  return (
    <Form className="rate-call-dialog" onSubmit={onRate}>
      <h3>Please rate the call</h3>
      <FormGroup>
        <Radio inline name="score" value={1}>1</Radio>
        <Radio inline name="score" value={2}>2</Radio>
        <Radio inline name="score" value={3}>3</Radio>
        <Radio inline name="score" value={4}>4</Radio>
        <Radio inline name="score" value={5}>5</Radio>
      </FormGroup>
      <FormGroup>
        <FormControl
          componentClass="textarea"
          name="comments"
          placeholder="Enter your feedback (optional)"
          title="Enter your feedback (optional)"
        />
      </FormGroup>
      <Checkbox name="includeLogs">Include client logs?</Checkbox>
      <Button type="submit">Send Feedback</Button>
      <Button onClick={onSkip} title="Skip" type="button">Skip</Button>
    </Form>
  );
}

RateDialog.propTypes = {
  onRate: React.PropTypes.func.isRequired,
  onSkip: React.PropTypes.func.isRequired
};
