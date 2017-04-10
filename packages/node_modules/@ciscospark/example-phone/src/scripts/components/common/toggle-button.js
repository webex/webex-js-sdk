import React from 'react';
import {Button} from 'react-bootstrap';

export default function ToggleButton({
  active,
  activeStyle,
  activeTitle,
  children,
  inactiveStyle,
  inactiveTitle,
  onActivate,
  onDeactivate,
  ...props
}) {
  return (
    <Button
      bsStyle={(active ? activeStyle : inactiveStyle) || `default`}
      onClick={active ? onDeactivate : onActivate}
      title={active ? activeTitle : inactiveTitle}
      {...props}
    >{children}</Button>
  );
}

ToggleButton.propTypes = {
  active: React.PropTypes.bool.isRequired,
  activeStyle: React.PropTypes.string.isRequired,
  activeTitle: React.PropTypes.string.isRequired,
  children: React.PropTypes.node,
  inactiveStyle: React.PropTypes.string.isRequired,
  inactiveTitle: React.PropTypes.string.isRequired,
  onActivate: React.PropTypes.func.isRequired,
  onDeactivate: React.PropTypes.func.isRequired
};
