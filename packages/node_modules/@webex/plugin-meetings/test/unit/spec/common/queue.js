import {assert} from '@webex/test-helper-chai';
import SimpleQueue from '@webex/plugin-meetings/src/common/queue';

describe('common/queue', () => {
  let fifo = null;

  const enqueue = (loops) => {
    for (let i = 0; i < loops; i += 1) {
      fifo.enqueue(i);
    }
  };

  beforeEach(() => {
    fifo = new SimpleQueue();
  });

  afterEach(() => {
    if (fifo) {
      fifo.clear();
      fifo = null;
    }
  });

  it('Returns the number of items in queue.', () => {
    const loops = 10;

    enqueue(loops);

    assert.equal(fifo.queue.length, loops);
  });

  it('Removes all of the elements from queue.', () => {
    const loops = 10;

    enqueue(loops);

    fifo.clear();

    assert.equal(fifo.size(), 0);
  });

  it('Inserts specified elements into the queue.', () => {
    const item1 = {text: 'fake item1'};
    const item2 = {text: 'fake item2'};

    fifo.enqueue(item1);
    fifo.enqueue(item2);

    assert.equal(fifo.queue[0], item1);
    assert.equal(fifo.queue[1], item2);
  });

  it('Returns and removes the head of the queue.', () => {
    const item1 = {text: 'fake item1'};
    const item2 = {text: 'fake item2'};

    fifo.enqueue(item1);
    fifo.enqueue(item2);
    const head = fifo.dequeue();
    const nextHead = fifo.queue[0];

    assert.equal(head, item1);
    assert.equal(nextHead, item2);
  });

  it('Returns null if the queue is empty.', () => {
    assert.equal(fifo.dequeue(), null);
  });
});
