import React from 'react';
import {Provider} from 'react-redux';
import renderer from 'react-test-renderer';

import store from '../../store';

import injectFileDownloader from '.';

function testComponent(props) {
  return <div {...props} />;
}

describe(`FileDownloader container`, () => {
  const props = {
    files: [{
      url: `testFile1.jpg`
    }, {
      url: `testFile2.jpg`
    }]
  };

  const InjectedComponent = injectFileDownloader(testComponent);

  const component = renderer.create(
    <Provider store={store}>
      <InjectedComponent {...props} />
    </Provider>
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
