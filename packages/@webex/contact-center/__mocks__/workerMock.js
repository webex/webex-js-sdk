class Worker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }

  postMessage(msg) {
    this.onmessage(msg);
  }

  terminate() {}
}

global.Worker = Worker;
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');
