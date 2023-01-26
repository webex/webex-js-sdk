// eslint-disable-next-line import/prefer-default-export
export const millisToMinutesAndSeconds = (millis: number) => {
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);

  return `${minutes}:${+seconds < 10 ? '0' : ''}${seconds}`;
};
