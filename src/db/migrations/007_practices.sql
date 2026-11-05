CREATE TABLE habits (
 id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title))>0),life_area_id TEXT REFERENCES life_areas(id) ON DELETE RESTRICT,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX habits_user ON habits(user_id,archived);
CREATE TABLE habit_rules (
 habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE RESTRICT,effective_from TEXT NOT NULL,
 frequency TEXT NOT NULL CHECK(frequency IN('days','weekly','monthly','interval')),
 weekdays TEXT NOT NULL DEFAULT '[]',every_days INTEGER NOT NULL DEFAULT 1 CHECK(every_days>0),
 quota INTEGER NOT NULL DEFAULT 1 CHECK(quota>0),target_kind TEXT NOT NULL CHECK(target_kind IN('count','quantity','duration')),
 target REAL NOT NULL CHECK(target>0),unit TEXT NOT NULL DEFAULT '',PRIMARY KEY(habit_id,effective_from)
) STRICT;
CREATE TABLE habit_entries (
 habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE RESTRICT,day TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('done','skip','missed','progress')),value REAL NOT NULL DEFAULT 0 CHECK(value>=0),
 note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(habit_id,day)
) STRICT;
CREATE TABLE habit_pauses (
 id TEXT PRIMARY KEY NOT NULL,habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE RESTRICT,
 from_day TEXT NOT NULL,to_day TEXT,CHECK(to_day IS NULL OR to_day>=from_day)
) STRICT;
CREATE UNIQUE INDEX habit_open_pause ON habit_pauses(habit_id) WHERE to_day IS NULL;
CREATE TABLE routines (
 id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title))>0),archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE routine_steps (
 id TEXT PRIMARY KEY NOT NULL,routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title))>0),kind TEXT NOT NULL CHECK(kind IN('simple','checklist','task','habit','timer')),
 checklist TEXT NOT NULL DEFAULT '[]',task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,habit_id TEXT REFERENCES habits(id) ON DELETE RESTRICT,
 target_minutes INTEGER CHECK(target_minutes>0),position INTEGER NOT NULL CHECK(position>=0),archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1))
) STRICT;
CREATE INDEX routine_step_order ON routine_steps(routine_id,archived,position);
CREATE TABLE routine_runs (
 id TEXT PRIMARY KEY NOT NULL,routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE RESTRICT,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('running','completed')),current_step INTEGER NOT NULL DEFAULT 0 CHECK(current_step>=0),
 started_at TEXT NOT NULL,ended_at TEXT,CHECK((status='running' AND ended_at IS NULL) OR (status='completed' AND ended_at IS NOT NULL))
) STRICT;
CREATE INDEX routine_runs_user ON routine_runs(user_id,status,started_at);
CREATE TABLE routine_run_steps (
 id TEXT PRIMARY KEY NOT NULL,run_id TEXT NOT NULL REFERENCES routine_runs(id) ON DELETE RESTRICT,source_step_id TEXT NOT NULL REFERENCES routine_steps(id) ON DELETE RESTRICT,
 title TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('simple','checklist','task','habit','timer')),
 checklist TEXT NOT NULL DEFAULT '[]',checks TEXT NOT NULL DEFAULT '[]',task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,habit_id TEXT REFERENCES habits(id) ON DELETE RESTRICT,
 target_minutes INTEGER,position INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','done','skip')),completed_at TEXT
) STRICT;
CREATE INDEX run_step_order ON routine_run_steps(run_id,position);
CREATE TABLE trackers (
 id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,title TEXT NOT NULL CHECK(length(trim(title))>0),
 kind TEXT NOT NULL CHECK(kind IN('number','duration','counter','boolean','scale')),unit TEXT NOT NULL DEFAULT '',target REAL,
 frequency TEXT NOT NULL CHECK(frequency IN('daily','weekly','monthly')),scale_min REAL NOT NULL DEFAULT 0,scale_max REAL NOT NULL DEFAULT 10,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,CHECK(scale_max>scale_min)
) STRICT;
CREATE TABLE tracker_entries (
 tracker_id TEXT NOT NULL REFERENCES trackers(id) ON DELETE RESTRICT,day TEXT NOT NULL,value REAL NOT NULL,note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(tracker_id,day)
) STRICT;
ALTER TABLE time_sessions ADD COLUMN habit_id TEXT REFERENCES habits(id) ON DELETE RESTRICT;
ALTER TABLE time_sessions ADD COLUMN routine_run_id TEXT REFERENCES routine_runs(id) ON DELETE RESTRICT;
ALTER TABLE time_sessions ADD COLUMN routine_run_step_id TEXT REFERENCES routine_run_steps(id) ON DELETE RESTRICT;
CREATE INDEX time_session_habit ON time_sessions(user_id,habit_id,status,started_at);
CREATE TRIGGER practice_time_owner BEFORE INSERT ON time_sessions BEGIN
 SELECT RAISE(ABORT,'Invalid practice time context') WHERE
 (NEW.habit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM habits WHERE id=NEW.habit_id AND user_id=NEW.user_id)) OR
 (NEW.routine_run_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM routine_runs WHERE id=NEW.routine_run_id AND user_id=NEW.user_id)) OR
 (NEW.routine_run_step_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM routine_run_steps WHERE id=NEW.routine_run_step_id AND run_id=NEW.routine_run_id));
END;
CREATE TRIGGER practice_time_immutable BEFORE UPDATE OF habit_id,routine_run_id,routine_run_step_id ON time_sessions BEGIN SELECT RAISE(ABORT,'Practice time snapshot is immutable'); END;
CREATE TRIGGER habit_area_owner BEFORE INSERT ON habits WHEN NEW.life_area_id IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'Invalid habit area owner') WHERE NOT EXISTS(SELECT 1 FROM life_areas WHERE id=NEW.life_area_id AND user_id=NEW.user_id);
END;
CREATE TRIGGER habits_owner_immutable BEFORE UPDATE OF user_id ON habits WHEN NEW.user_id!=OLD.user_id BEGIN SELECT RAISE(ABORT,'Owner is immutable'); END;
CREATE TRIGGER routines_owner_immutable BEFORE UPDATE OF user_id ON routines WHEN NEW.user_id!=OLD.user_id BEGIN SELECT RAISE(ABORT,'Owner is immutable'); END;
CREATE TRIGGER trackers_owner_immutable BEFORE UPDATE OF user_id ON trackers WHEN NEW.user_id!=OLD.user_id BEGIN SELECT RAISE(ABORT,'Owner is immutable'); END;
CREATE TRIGGER routine_step_owner_insert BEFORE INSERT ON routine_steps BEGIN SELECT RAISE(ABORT,'Invalid routine step owner') WHERE (NEW.task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks t JOIN routines r ON t.user_id=r.user_id WHERE t.id=NEW.task_id AND r.id=NEW.routine_id)) OR (NEW.habit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM habits h JOIN routines r ON h.user_id=r.user_id WHERE h.id=NEW.habit_id AND r.id=NEW.routine_id)); END;
CREATE TRIGGER routine_step_owner_update BEFORE UPDATE ON routine_steps BEGIN SELECT RAISE(ABORT,'Invalid routine step owner') WHERE (NEW.task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks t JOIN routines r ON t.user_id=r.user_id WHERE t.id=NEW.task_id AND r.id=NEW.routine_id)) OR (NEW.habit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM habits h JOIN routines r ON h.user_id=r.user_id WHERE h.id=NEW.habit_id AND r.id=NEW.routine_id)); END;
CREATE TRIGGER routine_run_owner BEFORE INSERT ON routine_runs BEGIN SELECT RAISE(ABORT,'Invalid routine run owner') WHERE NOT EXISTS(SELECT 1 FROM routines WHERE id=NEW.routine_id AND user_id=NEW.user_id); END;
CREATE TRIGGER habit_area_immutable BEFORE UPDATE OF life_area_id ON habits WHEN NEW.life_area_id IS NOT OLD.life_area_id BEGIN SELECT RAISE(ABORT,'Habit area is immutable'); END;
CREATE TRIGGER run_step_owner BEFORE INSERT ON routine_run_steps BEGIN
 SELECT RAISE(ABORT,'Invalid run step owner') WHERE
 NOT EXISTS(SELECT 1 FROM routine_steps s JOIN routine_runs r ON r.routine_id=s.routine_id WHERE s.id=NEW.source_step_id AND r.id=NEW.run_id) OR
 (NEW.task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks t JOIN routine_runs r ON t.user_id=r.user_id WHERE t.id=NEW.task_id AND r.id=NEW.run_id)) OR
 (NEW.habit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM habits h JOIN routine_runs r ON h.user_id=r.user_id WHERE h.id=NEW.habit_id AND r.id=NEW.run_id));
END;
CREATE TRIGGER run_snapshot_immutable BEFORE UPDATE OF routine_id,user_id,title,started_at ON routine_runs BEGIN SELECT RAISE(ABORT,'Run snapshot is immutable'); END;
CREATE TRIGGER run_step_snapshot_immutable BEFORE UPDATE OF run_id,source_step_id,title,kind,checklist,task_id,habit_id,target_minutes,position ON routine_run_steps BEGIN SELECT RAISE(ABORT,'Run step snapshot is immutable'); END;
CREATE TRIGGER tracker_value_insert BEFORE INSERT ON tracker_entries BEGIN SELECT RAISE(ABORT,'Tracker value out of bounds') WHERE abs(NEW.value)>1000000000 OR EXISTS(SELECT 1 FROM trackers WHERE id=NEW.tracker_id AND ((kind='boolean' AND NEW.value NOT IN(0,1)) OR (kind IN('duration','counter') AND NEW.value<0) OR (kind='scale' AND (NEW.value<scale_min OR NEW.value>scale_max)))); END;
CREATE TRIGGER tracker_value_update BEFORE UPDATE ON tracker_entries BEGIN SELECT RAISE(ABORT,'Tracker value out of bounds') WHERE abs(NEW.value)>1000000000 OR EXISTS(SELECT 1 FROM trackers WHERE id=NEW.tracker_id AND ((kind='boolean' AND NEW.value NOT IN(0,1)) OR (kind IN('duration','counter') AND NEW.value<0) OR (kind='scale' AND (NEW.value<scale_min OR NEW.value>scale_max)))); END;
