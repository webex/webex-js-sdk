import {createSpark} from './spark';

describe(`spark`, () => {
  it(`is authenticated`, () => {
    const spark = createSpark(process.env.CISCOSPARK_ACCESS_TOKEN);
    expect(spark.isAuthenticated).toBe(true);
  });
});
