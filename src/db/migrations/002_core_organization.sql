CREATE TABLE life_areas (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  description TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX life_areas_user_order ON life_areas(user_id, position, id);

CREATE TABLE goals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('numeric', 'frequency', 'duration', 'milestones', 'manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'archived')),
  target_value REAL CHECK(target_value >= 0),
  target_unit TEXT,
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX goals_user_status ON goals(user_id, status);

CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  life_area_id TEXT REFERENCES life_areas(id) ON DELETE SET NULL,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'waiting', 'someday', 'completed', 'archived')),
  start_date TEXT,
  deadline TEXT,
  progress_mode TEXT NOT NULL DEFAULT 'none' CHECK(progress_mode IN ('task_based', 'milestones', 'manual', 'none')),
  manual_progress REAL CHECK(manual_progress BETWEEN 0 AND 100),
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((progress_mode = 'manual' AND manual_progress IS NOT NULL) OR (progress_mode != 'manual' AND manual_progress IS NULL)),
  CHECK(start_date IS NULL OR deadline IS NULL OR start_date <= deadline)
) STRICT;
CREATE INDEX projects_user_status_order ON projects(user_id, status, position, id);
CREATE INDEX projects_area ON projects(life_area_id);
CREATE INDEX projects_goal ON projects(goal_id);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX milestones_project_order ON milestones(project_id, position, id);

-- Foreign keys preserve optional relations; triggers additionally enforce owner equality.
CREATE TRIGGER projects_owner_insert BEFORE INSERT ON projects BEGIN
  SELECT RAISE(ABORT, 'Project relations must belong to the same user')
  WHERE (NEW.life_area_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM life_areas WHERE id = NEW.life_area_id AND user_id = NEW.user_id))
     OR (NEW.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id));
END;
CREATE TRIGGER projects_owner_update BEFORE UPDATE OF user_id, life_area_id, goal_id ON projects BEGIN
  SELECT RAISE(ABORT, 'Project relations must belong to the same user')
  WHERE (NEW.life_area_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM life_areas WHERE id = NEW.life_area_id AND user_id = NEW.user_id))
     OR (NEW.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id));
END;
CREATE TRIGGER life_areas_owner_immutable BEFORE UPDATE OF user_id ON life_areas
WHEN OLD.user_id != NEW.user_id BEGIN SELECT RAISE(ABORT, 'Owner cannot change'); END;
CREATE TRIGGER goals_owner_immutable BEFORE UPDATE OF user_id ON goals
WHEN OLD.user_id != NEW.user_id BEGIN SELECT RAISE(ABORT, 'Owner cannot change'); END;
CREATE TRIGGER projects_owner_immutable BEFORE UPDATE OF user_id ON projects
WHEN OLD.user_id != NEW.user_id BEGIN SELECT RAISE(ABORT, 'Owner cannot change'); END;
