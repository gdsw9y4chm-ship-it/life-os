CREATE TABLE time_sessions (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title)) > 0),
 status TEXT NOT NULL CHECK(status IN ('running','paused','completed')),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('quick','task','project','life_area','planner','manual','habit','routine')),
 task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,
 project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
 goal_id TEXT REFERENCES goals(id) ON DELETE RESTRICT,
 life_area_id TEXT REFERENCES life_areas(id) ON DELETE RESTRICT,
 planner_id TEXT REFERENCES planner_series(id) ON DELETE RESTRICT,
 occurrence_key TEXT,
 planned_minutes REAL CHECK(planned_minutes > 0),
 target_minutes INTEGER CHECK(target_minutes > 0),
 started_at TEXT NOT NULL,
 ended_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK((status='completed' AND ended_at IS NOT NULL AND ended_at >= started_at) OR (status!='completed' AND ended_at IS NULL))
) STRICT;
-- Paused sessions deliberately do not participate in this constraint.
CREATE UNIQUE INDEX one_running_session_per_user ON time_sessions(user_id) WHERE status='running';
CREATE INDEX time_sessions_user_history ON time_sessions(user_id,started_at);
CREATE TABLE time_pauses (
 id TEXT PRIMARY KEY NOT NULL,
 session_id TEXT NOT NULL REFERENCES time_sessions(id) ON DELETE RESTRICT,
 started_at TEXT NOT NULL,
 ended_at TEXT,
 CHECK(ended_at IS NULL OR ended_at >= started_at)
) STRICT;
CREATE INDEX time_pauses_session ON time_pauses(session_id,started_at);
CREATE UNIQUE INDEX one_open_pause_per_session ON time_pauses(session_id) WHERE ended_at IS NULL;
CREATE TRIGGER time_session_owner BEFORE INSERT ON time_sessions BEGIN
 SELECT RAISE(ABORT,'Invalid time session context') WHERE
 (NEW.task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks WHERE id=NEW.task_id AND user_id=NEW.user_id)) OR
 (NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND user_id=NEW.user_id)) OR
 (NEW.goal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goals WHERE id=NEW.goal_id AND user_id=NEW.user_id)) OR
 (NEW.life_area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM life_areas WHERE id=NEW.life_area_id AND user_id=NEW.user_id)) OR
 (NEW.planner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM planner_series WHERE id=NEW.planner_id AND user_id=NEW.user_id));
END;
CREATE TRIGGER time_context_immutable BEFORE UPDATE OF user_id,task_id,project_id,goal_id,life_area_id,planner_id,occurrence_key,planned_minutes ON time_sessions
BEGIN SELECT RAISE(ABORT,'Time session context snapshot is immutable'); END;
