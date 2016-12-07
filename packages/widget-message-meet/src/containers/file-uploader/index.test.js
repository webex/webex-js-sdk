/* eslint max-nested-callbacks: ["error", 3] */
import React from 'react';
import {Provider} from 'react-redux';
import renderer from 'react-test-renderer';
import {Map} from 'immutable';

import fh from '@ciscospark/test-helper-file';

import store from '../../store';

import {FileUploader} from '.';


describe(`FileUploader container`, () => {
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
      pptFile.type = `application/vnd.openxmlformats-officedocument.presentationml.presentation`;
    })
  );

  beforeEach(() => {
    props = {
      onSubmit: jest.fn(),
      activity: new Map({
        files: new Map({
          file1: txtFile,
          file2: pptFile
        })
      })
    };
  });

  it(`renders properly`, () => {
    const renderedComponent = renderer.create(
      <Provider store={store}>
        <FileUploader {...props} />
      </Provider>
    );

    expect(renderedComponent).toMatchSnapshot();
  });

  it(`should add files to store`, () => {
    const addFiles = jest.fn();
    props.addFiles = addFiles;
    const e = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      target: {
        files: [txtFile, pptFile]
      }
    };

    component = new FileUploader(props);
    component.handleFileChange(e);
    expect(addFiles).toBeCalled();
  });

  it(`should remove files from store`, () => {
    const removeFile = jest.fn();
    props.removeFile = removeFile;
    component = new FileUploader(props);
    component.handleFileRemove(123);
    expect(removeFile).toBeCalledWith(123, props.activity);
  });

});
