let resolveReady: () => void = () => {};
let ready = false;

const readyPromise: Promise<void> = new Promise((res) => {
  resolveReady = res;
});

export function markSiteReady(): void {
  if (ready) return;
  ready = true;
  resolveReady();
}

export function waitSiteReady(): Promise<void> {
  return ready ? Promise.resolve() : readyPromise;
}
