import {createSpark} from './spark';

describe(`spark`, () => {
  it(`is authenticated`, () => {
    const spark = createSpark();
    expect(spark.isAuthenticated).toBe(true);
  });
});
