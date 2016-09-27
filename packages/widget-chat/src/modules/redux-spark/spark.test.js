import spark from './spark';

it(`is authenticated`, () => {
  expect(spark.isAuthenticated).toBe(true);
});
