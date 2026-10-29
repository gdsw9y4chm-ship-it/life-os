import type { UserRepository } from '../types/user';

export class UserService {
  constructor(private readonly users: UserRepository) {}

  getCurrentUser() {
    return this.users.getCurrent();
  }

  initializeProfile() {
    return this.users.seedInitial();
  }
}
