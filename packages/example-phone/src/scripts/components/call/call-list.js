import React from 'react';
import {ListGroup, ListGroupItem} from 'react-bootstrap';
import CallListItem from './call-list-item';

export default function CallList({calls, ...props}) {
  return (
    <ListGroup>
      {calls.map((call) =>
        <ListGroupItem key={call.locusUrl}>
          <CallListItem call={call} {...props} />
        </ListGroupItem>
      )}
    </ListGroup>
  );
}

CallList.propTypes = {
  calls: React.PropTypes.array.isRequired
};
