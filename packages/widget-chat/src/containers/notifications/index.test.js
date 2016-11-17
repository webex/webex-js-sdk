import {Notifications} from '.';

describe(`Notifications component`, () => {
  let component;
  let props;
  const notificationSent = jest.fn();
  const setNotificationPermission = jest.fn();
  const setNotificationSupported = jest.fn();
  beforeEach(() => {
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

});
