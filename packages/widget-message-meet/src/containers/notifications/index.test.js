/* eslint-disable-reason nested callbacks for test blocks */
/* eslint-disable max-nested-callbacks */
import {Notifications} from '.';
import browserUtilities from '../../utils/browser';

describe(`Notifications component`, () => {
  let component;
  let props;
  let notificationSent;
  let setNotificationPermission;
  let setNotificationSupported;

  beforeEach(() => {
    notificationSent = jest.fn();
    setNotificationPermission = jest.fn();
    setNotificationSupported = jest.fn();
    props = {
      isSupported: false,
      notifications: [],
      permission: null,
      notificationSent,
      setNotificationPermission,
      setNotificationSupported
    };
    component = new Notifications(props);
  });

  it(`should instantiate`, () => {
    expect(component).toBeDefined();
  });

  it(`should set supported true if true`, () => {
    browserUtilities.isNotificationSupported = () => true;
    component.componentDidUpdate();
    expect(setNotificationSupported).toBeCalledWith(true);
  });

  it(`should not set supported true if false`, () => {
    browserUtilities.isNotificationSupported = () => false;
    component.componentDidUpdate();
    expect(setNotificationSupported).not.toBeCalledWith(true);
  });

  it(`should request permissions and set result if supported`, () => {
    component.requestPermission = jest.fn();
    component.props.isSupported = true;
    component.componentDidUpdate();
    expect(component.requestPermission).toBeCalled();
  });

  it(`should request permissions and set result`, () => {
    browserUtilities.requestPermissionForNotifications = jest.fn(() => browserUtilities.PERMISSION_GRANTED);
    component.requestPermission(() => {
      expect(setNotificationPermission).toBeCalledWith(browserUtilities.PERMISSION_GRANTED);
    });
  });

  it(`should mark notification as sent after displaying`, () => {
    const notification = {
      username: `username`,
      message: `message`,
      avatar: `avatar`,
      notificationId: `abc123`
    };
    component.props.notifications = [notification];
    component.permission = browserUtilities.PERMISSION_GRANTED;
    component.displayNotifications();
    expect(notificationSent).toBeCalled();
  });

  it(`should display the notification if the browser is hidden`, () => {
    const notification = {
      username: `username`,
      message: `message`,
      avatar: `avatar`,
      notificationId: `abc123`
    };
    component.props.notifications = [notification];
    component.props.permission = browserUtilities.PERMISSION_GRANTED;
    browserUtilities.isBrowserHidden = jest.fn(() => true);
    browserUtilities.spawnNotification = jest.fn();

    component.displayNotifications();

    expect(browserUtilities.spawnNotification).toBeCalled();
  });

});
