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
    // eslint-disable-next-line import/no-named-as-default-member
    browserUtilities.isNotificationSupported = () => true;
    component.componentDidUpdate();
    expect(setNotificationSupported).toBeCalledWith(true);
  });

  it(`should not set supported true if false`, () => {
    // eslint-disable-next-line import/no-named-as-default-member
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
    // eslint-disable-next-line import/no-named-as-default-member
    browserUtilities.requestPermissionForNotifications = jest.fn(() => browserUtilities.PERMISSION_GRANTED);
    component.requestPermission(() => {
      // eslint-disable-next-line import/no-named-as-default-member
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
    // eslint-disable-next-line import/no-named-as-default-member
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
    // eslint-disable-next-line import/no-named-as-default-member
    component.props.permission = browserUtilities.PERMISSION_GRANTED;
    // eslint-disable-next-line import/no-named-as-default-member
    browserUtilities.isBrowserHidden = jest.fn(() => true);
    // eslint-disable-next-line import/no-named-as-default-member
    browserUtilities.spawnNotification = jest.fn();

    component.displayNotifications();

    // eslint-disable-next-line import/no-named-as-default-member
    expect(browserUtilities.spawnNotification).toBeCalled();
  });

});
