import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
// SSR buttons stay disabled until React can handle clicks, including on slow loads.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
