export async function register(calling) {
  if (!calling) throw new Error('Calling not initialized');
  await calling.register();
}

export async function deregister(calling) {
  if (!calling) return;
  await calling.deregister();
}

export function getPrimaryLine(callingClient) {
  if (!callingClient) return undefined;
  console.log('callingClient', callingClient);
  const lines = callingClient.getLines();
  const first = Object.values(lines)[0];
  console.log('first', first);
  return first;
}



