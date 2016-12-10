



export function createRooms(numRooms, spark) {
  const promises = [];
  for (let idx = 0; idx < numRooms; idx++) {
    promises.push(spark.rooms.create({title: 'Test Room ' + idx}));
  }
  return Promise.all(promises);
}

export function createBoards(numBoards, roomId, spark) {
  const promises = [];
  for (let idx = 0; idx < numBoards; idx++) {
    promises.push(spark.whiteboards.create({roomId: roomId}));
  }
  return Promise.all(promises);
}
