import { createServerFn } from '@tanstack/react-start';

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const { readCurrentUser } = await import('../../services/user-service.server');
  return readCurrentUser();
});
