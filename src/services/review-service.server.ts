import { connectDatabase, databasePath } from "../db/connection";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { SqliteReviewRepository } from "../db/repositories/sqlite-review-repository";
import { ReviewService } from "./review-service";
import { requireRecord } from "./organization-rules";
import type { User } from "../types/user";
export function withReview<T>(fn: (s: ReviewService, u: User) => T) {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() =>
      fn(
        new ReviewService(new SqliteReviewRepository(db)),
        requireRecord(new SqliteUserRepository(db).getCurrent()),
      ),
    )();
  } finally {
    db.close();
  }
}
