CREATE TABLE reset_runs (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN('weekly','monthly')),
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL CHECK(period_end>=period_start),
 cursor INTEGER NOT NULL DEFAULT 0 CHECK(cursor>=0 AND cursor<8),
 steps TEXT NOT NULL,
 priorities TEXT NOT NULL DEFAULT '[]',
 notes TEXT NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 completed_at TEXT,
 UNIQUE(user_id,kind,period_start)
) STRICT;
CREATE TRIGGER reset_identity_immutable BEFORE UPDATE OF user_id,kind,period_start,period_end,created_at ON reset_runs BEGIN SELECT RAISE(ABORT,'Reset identity is immutable'); END;
