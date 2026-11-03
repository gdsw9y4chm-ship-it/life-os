import { useHydrated } from "../../lib/use-hydrated";
import { useState, useRef, type FormEvent, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Button,
  Input,
  Select,
  Badge,
  Checkbox,
} from "../../design-system/components/primitives";
import { saveTask } from "./api";
import type { TaskCommand } from "../../services/task-service";
import type { TaskSummary, TaskInput } from "../../types/task";
import { taskPriorities } from "../../types/task";
import type { TaskReferences } from "../../types/task";
export const taskLabels: Record<string, string> = {
  inbox: "Inbox",
  todo: "To Do",
  doing: "Doing",
  waiting: "Waiting",
  done: "Done",
  someday: "Someday",
  must: "Must",
  should: "Should",
  could: "Could",
  none: "Aucune",
  low: "Low",
  medium: "Medium",
  deep: "Deep",
  today: "Today",
  upcoming: "Upcoming",
  "follow-ups": "À relancer",
  overdue: "Overdue",
  completed: "Completed",
  unscheduled: "Sans Do Date",
  all: "Toutes",
  archived: "Archives",
};
export function useTaskMutation() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const hydrated = useHydrated(),
    saving = useRef(false);
  const router = useRouter();
  async function run(command: TaskCommand) {
    if (saving.current || !hydrated) return null;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveTask({ data: command });
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      await router.invalidate();
      return result;
    } catch {
      setError(
        "Enregistrement impossible. Vérifiez la connexion puis réessayez.",
      );
      return null;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return { busy: busy || !hydrated, error, run };
}
export function QuickCapture({
  defaults = {},
  onCreated,
  label = "Capturer une tâche",
}: {
  defaults?: Partial<TaskInput>;
  onCreated?: (id: string) => void;
  label?: string;
}) {
  const [title, setTitle] = useState(""),
    mutation = useTaskMutation();
  const hydrated = useHydrated();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutation.run({
      kind: "create",
      values: { ...defaults, title },
    });
    if (result?.id) {
      setTitle("");
      onCreated?.(result.id);
    }
  }
  return (
    <form onSubmit={submit} className="quick-capture">
      <div className="capture-fields">
        <Input
          label={label}
          placeholder="Une idée, une action… puis Entrée"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={300}
          disabled={!hydrated}
          readOnly={mutation.busy}
        />
        <Button type="submit" loading={mutation.busy}>
          Ajouter
        </Button>
      </div>
      {mutation.error && (
        <p role="alert" className="field-error">
          {mutation.error}
        </p>
      )}
    </form>
  );
}
type References = TaskReferences;
export function TaskList({
  tasks,
  references,
  groups,
  emptyState,
  onQuickActionsOpen,
  referencesReady = true,
}: {
  tasks: TaskSummary[];
  references: References;
  groups?: { priority: string; tasks: TaskSummary[] }[];
  emptyState?: ReactNode;
  onQuickActionsOpen?: () => void;
  referencesReady?: boolean;
}) {
  const mutation = useTaskMutation();
  const [undo, setUndo] = useState<TaskCommand | null>(null);
  async function change(command: TaskCommand, inverse?: TaskCommand) {
    if (await mutation.run(command)) setUndo(inverse ?? null);
  }
  return (
    <div className="task-list">
      {mutation.error && (
        <p role="alert" className="field-error">
          {mutation.error}
        </p>
      )}
      {undo && (
        <div className="task-feedback" role="status">
          Modification enregistrée.
          <Button
            variant="ghost"
            disabled={mutation.busy}
            onClick={async () => {
              if (await mutation.run(undo)) setUndo(null);
            }}
          >
            Annuler la dernière action
          </Button>
        </div>
      )}
      {!tasks.length &&
        (emptyState ?? (
          <p className="task-empty">
            Aucune tâche dans cette vue. Votre espace reste libre.
          </p>
        ))}
      {groups ? (
        groups.map((group) => (
          <section
            className={`task-priority-group task-priority-group--${group.priority}`}
            key={group.priority}
            aria-label={
              group.priority === "none"
                ? "Sans priorité"
                : taskLabels[group.priority]
            }
          >
            <h3>
              {group.priority === "none"
                ? "Sans priorité"
                : taskLabels[group.priority]}{" "}
              <span>{group.tasks.length}</span>
            </h3>
            <ul>
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  references={references}
                  busy={mutation.busy}
                  change={change}
                  onQuickActionsOpen={onQuickActionsOpen}
                  referencesReady={referencesReady}
                />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              references={references}
              busy={mutation.busy}
              change={change}
              onQuickActionsOpen={onQuickActionsOpen}
              referencesReady={referencesReady}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
export function TaskRow({
  task,
  references,
  busy,
  change,
  onQuickActionsOpen,
  referencesReady = true,
}: {
  task: TaskSummary;
  references: References;
  busy: boolean;
  change: (command: TaskCommand, inverse?: TaskCommand) => Promise<void>;
  onQuickActionsOpen?: () => void;
  referencesReady?: boolean;
}) {
  const patch = (values: Partial<TaskInput>) =>
    void change({ kind: "update", id: task.id, values });
  return (
    <li
      className={`task-row ${task.status === "done" ? "task-row--done" : ""}`}
    >
      <div className="task-row-main">
        <Checkbox
          label=""
          aria-label={`Terminer ${task.title}`}
          checked={task.status === "done"}
          disabled={busy || !!task.archived_at}
          onChange={() =>
            void change(
              {
                kind: "status",
                id: task.id,
                status: task.status === "done" ? "todo" : "done",
              },
              { kind: "status", id: task.id, status: task.status },
            )
          }
        />
        <div className="task-row-content">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: task.id }}
            className="task-title"
          >
            {task.title}
          </Link>
          <div className="task-metadata">
            {task.priority !== "none" && (
              <Badge tone="rose">{taskLabels[task.priority]}</Badge>
            )}
            {task.status === "waiting" && (
              <Badge>
                Waiting{task.waiting_for ? ` · ${task.waiting_for}` : ""}
              </Badge>
            )}
            {task.status === "inbox" && <span>À clarifier</span>}
            {task.status === "someday" && <span>Someday</span>}
            {task.do_date && <span>Do · {task.do_date}</span>}
            {task.deadline && <span>Deadline · {task.deadline}</span>}
            {task.project_title && <span>{task.project_title}</span>}
            {task.life_area_name && <span>{task.life_area_name}</span>}
            {task.estimated_minutes !== null && (
              <span>{task.estimated_minutes} min</span>
            )}
            {task.context && <span>{task.context}</span>}
            {task.parent_task_id && <span>Sous-tâche</span>}
          </div>
        </div>
        {task.status === "inbox" && !task.archived_at && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => patch({ status: "todo" })}
          >
            To Do
          </Button>
        )}
      </div>
      <details
        className="task-quick-actions"
        onToggle={(event) => {
          if (event.currentTarget.open) onQuickActionsOpen?.();
        }}
      >
        <summary>Actions rapides</summary>
        <fieldset disabled={busy || !referencesReady}>
          <div className="task-inline-fields">
            <Select
              label="Priorité"
              value={task.priority}
              onChange={(event) =>
                patch({
                  priority: event.target.value as TaskSummary["priority"],
                })
              }
            >
              {taskPriorities.map((value) => (
                <option key={value} value={value}>
                  {taskLabels[value]}
                </option>
              ))}
            </Select>
            <Input
              label="Do Date"
              type="date"
              value={task.do_date || ""}
              onChange={(event) =>
                patch({ do_date: event.target.value || null })
              }
            />
            <Select
              label="Project"
              value={task.project_id || ""}
              onChange={(event) =>
                patch({
                  project_id: event.target.value || null,
                  milestone_id: null,
                  life_area_id: null,
                })
              }
            >
              <option value="">Aucun</option>
              {references.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </Select>
            <Select
              label="Life Area"
              disabled={!!task.project_id}
              value={task.effective_life_area_id || ""}
              onChange={(event) =>
                patch({ life_area_id: event.target.value || null })
              }
            >
              <option value="">Aucune</option>
              {references.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="organization-actions">
            <Button
              variant="ghost"
              onClick={() => patch({ status: "someday" })}
            >
              Someday
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void change(
                  { kind: "archive", id: task.id, archived: !task.archived_at },
                  {
                    kind: "archive",
                    id: task.id,
                    archived: !!task.archived_at,
                  },
                )
              }
            >
              {task.archived_at ? "Restaurer" : "Archiver"}
            </Button>
          </div>
        </fieldset>
      </details>
    </li>
  );
}
