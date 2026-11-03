CREATE TABLE planner_series (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('event','time_block','scheduled_task')),
 title TEXT NOT NULL CHECK(length(trim(title)) > 0),
 start_local TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0 AND duration_minutes <= 10080),
 timezone TEXT NOT NULL,
 frequency TEXT NOT NULL DEFAULT 'once' CHECK(frequency IN ('once','daily','weekly','monthly')),
 interval_count INTEGER NOT NULL DEFAULT 1 CHECK(interval_count BETWEEN 1 AND 365),
 weekdays TEXT NOT NULL DEFAULT '[]',
 until_day TEXT,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX planner_user_range ON planner_series(user_id,archived,start_local,until_day);
CREATE TABLE events (
 id TEXT PRIMARY KEY NOT NULL REFERENCES planner_series(id) ON DELETE RESTRICT,
 location TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE TABLE time_blocks (
 id TEXT PRIMARY KEY NOT NULL REFERENCES planner_series(id) ON DELETE RESTRICT,
 project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
 life_area_id TEXT REFERENCES life_areas(id) ON DELETE SET NULL
) STRICT;
CREATE TABLE scheduled_tasks (
 id TEXT PRIMARY KEY NOT NULL REFERENCES planner_series(id) ON DELETE RESTRICT,
 task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX scheduled_tasks_task ON scheduled_tasks(task_id);
CREATE TABLE planner_exceptions (
 series_id TEXT NOT NULL REFERENCES planner_series(id) ON DELETE RESTRICT,
 occurrence_day TEXT NOT NULL,
 cancelled INTEGER NOT NULL DEFAULT 0 CHECK(cancelled IN (0,1)),
 start_local TEXT,
 duration_minutes INTEGER CHECK(duration_minutes > 0 AND duration_minutes <= 10080),
 title TEXT,
 PRIMARY KEY(series_id,occurrence_day)
) STRICT;
CREATE TRIGGER scheduled_task_owner BEFORE INSERT ON scheduled_tasks BEGIN
 SELECT RAISE(ABORT,'Invalid scheduled task owner') WHERE NOT EXISTS (
 SELECT 1 FROM tasks t JOIN planner_series s ON s.user_id=t.user_id
 WHERE t.id=NEW.task_id AND s.id=NEW.id AND s.kind='scheduled_task');
END;
CREATE TRIGGER time_block_owner BEFORE INSERT ON time_blocks BEGIN
 SELECT RAISE(ABORT,'Invalid time block relations') WHERE
 NOT EXISTS (SELECT 1 FROM planner_series WHERE id=NEW.id AND kind='time_block') OR
 (NEW.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects p JOIN planner_series s ON s.user_id=p.user_id WHERE p.id=NEW.project_id AND s.id=NEW.id)) OR
 (NEW.life_area_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM life_areas a JOIN planner_series s ON s.user_id=a.user_id WHERE a.id=NEW.life_area_id AND s.id=NEW.id));
END;
CREATE TRIGGER event_kind BEFORE INSERT ON events BEGIN
 SELECT RAISE(ABORT,'Invalid event kind') WHERE NOT EXISTS (SELECT 1 FROM planner_series WHERE id=NEW.id AND kind='event');
END;
CREATE TRIGGER planner_owner_immutable BEFORE UPDATE OF user_id,kind ON planner_series
WHEN NEW.user_id != OLD.user_id OR NEW.kind != OLD.kind BEGIN SELECT RAISE(ABORT,'Planner identity is immutable'); END;
