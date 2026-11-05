CREATE TABLE notes (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('quick','full')),
 title TEXT NOT NULL CHECK(length(trim(title))>0),
 body TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX notes_user_updated ON notes(user_id,archived,updated_at);
CREATE TABLE personal_lists (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title))>0),
 kind TEXT NOT NULL CHECK(kind IN ('simple','checklist','shopping','wishlist')),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX lists_user_updated ON personal_lists(user_id,archived,updated_at);
CREATE TABLE list_items (
 id TEXT PRIMARY KEY NOT NULL,
 list_id TEXT NOT NULL REFERENCES personal_lists(id) ON DELETE RESTRICT,
 label TEXT NOT NULL CHECK(length(trim(label))>0),
 details TEXT NOT NULL DEFAULT '',
 quantity REAL NOT NULL DEFAULT 1 CHECK(quantity>0),
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
 position INTEGER NOT NULL CHECK(position>=0),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX list_items_order ON list_items(list_id,position,id);
CREATE TABLE note_links (
 id TEXT PRIMARY KEY NOT NULL,
 note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE RESTRICT,
 project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
 life_area_id TEXT REFERENCES life_areas(id) ON DELETE RESTRICT,
 goal_id TEXT REFERENCES goals(id) ON DELETE RESTRICT,
 task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,
 event_id TEXT REFERENCES events(id) ON DELETE RESTRICT,
 note_target_id TEXT REFERENCES notes(id) ON DELETE RESTRICT,
 CHECK((project_id IS NOT NULL)+(life_area_id IS NOT NULL)+(goal_id IS NOT NULL)+(task_id IS NOT NULL)+(event_id IS NOT NULL)+(note_target_id IS NOT NULL)=1),
 CHECK(note_target_id IS NULL OR note_target_id!=note_id)
) STRICT;
CREATE INDEX note_links_note ON note_links(note_id);
CREATE UNIQUE INDEX unique_note_project ON note_links(note_id,project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX unique_note_area ON note_links(note_id,life_area_id) WHERE life_area_id IS NOT NULL;
CREATE UNIQUE INDEX unique_note_goal ON note_links(note_id,goal_id) WHERE goal_id IS NOT NULL;
CREATE UNIQUE INDEX unique_note_task ON note_links(note_id,task_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX unique_note_event ON note_links(note_id,event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX unique_note_note ON note_links(note_id,note_target_id) WHERE note_target_id IS NOT NULL;

CREATE TRIGGER note_link_owner_insert BEFORE INSERT ON note_links BEGIN SELECT RAISE(ABORT,'Invalid note relation owner') WHERE (NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM projects t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.project_id AND n.id=NEW.note_id)) OR (NEW.life_area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM life_areas t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.life_area_id AND n.id=NEW.note_id)) OR (NEW.goal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goals t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.goal_id AND n.id=NEW.note_id)) OR (NEW.task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.task_id AND n.id=NEW.note_id)) OR (NEW.event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM planner_series t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.event_id AND n.id=NEW.note_id)) OR (NEW.note_target_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM notes t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.note_target_id AND n.id=NEW.note_id)); END;
CREATE TRIGGER list_item_owner_insert BEFORE INSERT ON list_items WHEN NEW.task_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Invalid list Task owner') WHERE NOT EXISTS(SELECT 1 FROM tasks t JOIN personal_lists l ON l.user_id=t.user_id WHERE t.id=NEW.task_id AND l.id=NEW.list_id); END;

CREATE TRIGGER note_link_owner_update BEFORE UPDATE ON note_links BEGIN SELECT RAISE(ABORT,'Invalid note relation owner') WHERE (NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM projects t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.project_id AND n.id=NEW.note_id)) OR (NEW.life_area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM life_areas t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.life_area_id AND n.id=NEW.note_id)) OR (NEW.goal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goals t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.goal_id AND n.id=NEW.note_id)) OR (NEW.task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tasks t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.task_id AND n.id=NEW.note_id)) OR (NEW.event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM planner_series t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.event_id AND n.id=NEW.note_id)) OR (NEW.note_target_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM notes t JOIN notes n ON n.user_id=t.user_id WHERE t.id=NEW.note_target_id AND n.id=NEW.note_id)); END;
CREATE TRIGGER list_item_owner_update BEFORE UPDATE ON list_items WHEN NEW.task_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Invalid list Task owner') WHERE NOT EXISTS(SELECT 1 FROM tasks t JOIN personal_lists l ON l.user_id=t.user_id WHERE t.id=NEW.task_id AND l.id=NEW.list_id); END;
CREATE TRIGGER notes_owner_immutable BEFORE UPDATE OF user_id ON notes WHEN NEW.user_id!=OLD.user_id BEGIN SELECT RAISE(ABORT,'Owner is immutable'); END;
CREATE TRIGGER personal_lists_owner_immutable BEFORE UPDATE OF user_id ON personal_lists WHEN NEW.user_id!=OLD.user_id BEGIN SELECT RAISE(ABORT,'Owner is immutable'); END;
