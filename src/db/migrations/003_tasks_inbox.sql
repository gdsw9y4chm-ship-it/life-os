CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  life_area_id TEXT REFERENCES life_areas(id) ON DELETE SET NULL,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox','todo','doing','waiting','done','someday')),
  priority TEXT NOT NULL DEFAULT 'none' CHECK(priority IN ('must','should','could','none')),
  effort TEXT NOT NULL DEFAULT 'none' CHECK(effort IN ('low','medium','deep','none')),
  do_date TEXT,
  deadline TEXT,
  estimated_minutes INTEGER CHECK(estimated_minutes >= 0),
  context TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  waiting_for TEXT,
  waiting_since TEXT,
  follow_up_date TEXT,
  completed_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((status = 'done' AND completed_at IS NOT NULL) OR (status != 'done' AND completed_at IS NULL)),
  CHECK(project_id IS NULL OR life_area_id IS NULL),
  CHECK(parent_task_id IS NULL OR parent_task_id != id)
) STRICT;
CREATE INDEX tasks_user_status ON tasks(user_id, archived_at, status, position, id);
CREATE INDEX tasks_do_date ON tasks(user_id, do_date);
CREATE INDEX tasks_deadline ON tasks(user_id, deadline);
CREATE INDEX tasks_follow_up ON tasks(user_id, status, follow_up_date);
CREATE INDEX tasks_project ON tasks(project_id);
CREATE INDEX tasks_milestone ON tasks(milestone_id);
CREATE INDEX tasks_area ON tasks(life_area_id);
CREATE INDEX tasks_parent ON tasks(parent_task_id);

CREATE TABLE task_checklist_items (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  label TEXT NOT NULL CHECK(length(trim(label)) > 0),
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0,1)),
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX task_checklist_order ON task_checklist_items(task_id, position, id);
CREATE TABLE task_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE RESTRICT,
  remind_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX task_reminders_due ON task_reminders(user_id, remind_at);

CREATE TRIGGER tasks_relations_insert BEFORE INSERT ON tasks BEGIN
  SELECT RAISE(ABORT, 'Invalid Task relations') WHERE
    (NEW.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id AND user_id = NEW.user_id)) OR
    (NEW.life_area_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM life_areas WHERE id = NEW.life_area_id AND user_id = NEW.user_id)) OR
    (NEW.milestone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM milestones m JOIN projects p ON p.id = m.project_id WHERE m.id = NEW.milestone_id AND p.id = NEW.project_id AND p.user_id = NEW.user_id)) OR
    (NEW.parent_task_id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND user_id = NEW.user_id AND parent_task_id IS NULL) OR EXISTS (SELECT 1 FROM tasks WHERE parent_task_id = NEW.id)));
END;
CREATE TRIGGER reminders_owner_insert BEFORE INSERT ON task_reminders BEGIN
  SELECT RAISE(ABORT, 'Reminder owner mismatch') WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.task_id AND user_id = NEW.user_id);
END;

CREATE TRIGGER tasks_relations_update BEFORE UPDATE ON tasks BEGIN
  SELECT RAISE(ABORT, 'Invalid Task relations') WHERE
    (NEW.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id AND user_id = NEW.user_id)) OR
    (NEW.life_area_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM life_areas WHERE id = NEW.life_area_id AND user_id = NEW.user_id)) OR
    (NEW.milestone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM milestones m JOIN projects p ON p.id = m.project_id WHERE m.id = NEW.milestone_id AND p.id = NEW.project_id AND p.user_id = NEW.user_id)) OR
    (NEW.parent_task_id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND user_id = NEW.user_id AND parent_task_id IS NULL) OR EXISTS (SELECT 1 FROM tasks WHERE parent_task_id = NEW.id)));
END;
CREATE TRIGGER reminders_owner_update BEFORE UPDATE ON task_reminders BEGIN
  SELECT RAISE(ABORT, 'Reminder owner mismatch') WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.task_id AND user_id = NEW.user_id);
END;
CREATE TRIGGER tasks_owner_immutable BEFORE UPDATE OF user_id ON tasks
WHEN OLD.user_id != NEW.user_id BEGIN SELECT RAISE(ABORT, 'Owner cannot change'); END;
CREATE TRIGGER milestones_task_project BEFORE UPDATE OF project_id ON milestones
WHEN NEW.project_id != OLD.project_id AND EXISTS (SELECT 1 FROM tasks WHERE milestone_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Milestone has linked tasks'); END;
