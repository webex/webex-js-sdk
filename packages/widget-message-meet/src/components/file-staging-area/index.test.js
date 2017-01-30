/* eslint max-nested-callbacks: ["error", 3] */
import React from 'react';
import renderer from 'react-test-renderer';
import {Map} from 'immutable';

import fh from '@ciscospark/test-helper-file';

import FileStagingArea from '.';

describe(`FileStagingArea component`, () => {
  let component, props;
  let txtFile = `sample-text-one.txt`;
  let pptFile = `sample-powerpoint-two-page.ppt`;

  beforeAll(() =>
    Promise.all([
      fh.fetchWithoutMagic(txtFile),
      fh.fetchWithoutMagic(pptFile)
    ])
    .then((res) => {
      [txtFile, pptFile] = res;
      txtFile.type = `text/plain`;
      txtFile.id = `txtFile`;
      pptFile.type = `application/vnd.openxmlformats-officedocument.presentationml.presentation`;
      pptFile.id = `pptFile`;
    })
  );

  beforeEach(() => {
    props = {
      files: new Map({txtFile, pptFile}),
      onFileRemove: jest.fn(),
      onSubmit: jest.fn()
    };

    component = renderer.create(
      <FileStagingArea {...props} />
    );
  });


  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
