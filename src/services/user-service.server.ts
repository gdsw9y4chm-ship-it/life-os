import { connectDatabase, databasePath } from '../db/connection';
import { SqliteUserRepository } from '../db/repositories/sqlite-user-repository';
import { UserService } from './user-service';

export function readCurrentUser() {
  const db = connectDatabase(databasePath());
  try {
    return new UserService(new SqliteUserRepository(db)).getCurrentUser();
  } finally {
    db.close();
  }
}
