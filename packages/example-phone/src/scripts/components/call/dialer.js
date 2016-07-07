import React from 'react';
import {Button, FormControl, FormGroup} from 'react-bootstrap';
import Form from '../form';

export default function Dialer({onDial}) {
  return (
    <Form className="form-inline" onSubmit={onDial}>
      <FormGroup controlId="Address">
        <FormControl
          name="address"
          placeholder="Enter email address"
          title="Enter email address"
          type="text"
        />
      </FormGroup>
      <Button title="Dial" type="submit">Dial</Button>
    </Form>
  );
}

Dialer.propTypes = {
  onDial: React.PropTypes.func.isRequired
};
