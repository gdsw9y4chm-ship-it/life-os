import { TaskSources } from "../notes/search";
import { StartTimer } from "../time/provider";
import { Sheet } from "../../design-system/components/overlays";
import { useHydrated } from "../../lib/use-hydrated";
import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown } from "lucide-react";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  Section,
  Checkbox,
} from "../../design-system/components/primitives";
import {
  taskStatuses,
  taskPriorities,
  taskEfforts,
  taskContexts,
} from "../../types/task";
import type { TaskInput, ChecklistItem } from "../../types/task";
import {
  QuickCapture,
  TaskList,
  useTaskMutation,
  taskLabels,
} from "./components";
import { localReminder, reminderFromLocal } from "./reminder-time";
import type { getTask } from "./api";
type DetailData = Awaited<ReturnType<typeof getTask>>;
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => text(data, key) || null;
export function TaskDetailView({ data }: { data: DetailData }) {
  const { task } = data;
  const [editing, setEditing] = useState(false);
  const mutation = useTaskMutation();
  const milestone = data.milestones.find(
    (item) => item.id === task.milestone_id,
  );
  const properties = [
    ["Statut", taskLabels[task.status]],
    ["Priorité", taskLabels[task.priority]],
    ["Life Area", task.life_area_name || "Aucune"],
    ["Project", task.project_title || "Aucun"],
    ...(milestone ? [["Milestone", milestone.title]] : []),
    ["Do Date", task.do_date || "Non définie"],
    ["Deadline", task.deadline || "Non définie"],
    [
      "Reminder",
      data.reminder
        ? `${localReminder(data.reminder.remind_at, data.timezone).replace("T", " · ")} (${data.timezone})`
        : "Aucun",
    ],
    [
      "Durée estimée",
      task.estimated_minutes === null
        ? "Non renseignée"
        : `${task.estimated_minutes} min`,
    ],
    ["Effort", taskLabels[task.effort]],
    ["Contexte", task.context || "Aucun"],
  ];
  return (
    <PageLayout
      title="Tasks"
      subtitle="Les détails utiles, sans perdre le fil."
    >
      <Link
        to="/tasks"
        search={{ view: "inbox", context: "", q: "", project: "", area: "" }}
      >
        ← Retour aux tâches
      </Link>
      <h2 className="task-detail-title">{task.title}</h2><TaskSources id={task.id}/>
      {task.parent_task_id && (
        <Link to="/tasks/$taskId" params={{ taskId: task.parent_task_id }}>
          Ouvrir la tâche parente
        </Link>
      )}
      {task.archived_at && (
        <p role="status">
          Cette tâche est archivée. Ouvrez Modifier pour la restaurer.
        </p>
      )}
      <Card className="task-consultation">
        <div className="task-consultation-actions">
          <StartTimer source={{ kind: "task", id: task.id }} />
          <Button
            variant="secondary"
            disabled={mutation.busy || !!task.archived_at}
            onClick={() =>
              void mutation.run({
                kind: "status",
                id: task.id,
                status: task.status === "done" ? "todo" : "done",
              })
            }
          >
            {task.status === "done" ? "Rouvrir" : "Terminer"}
          </Button>
          <Sheet
            title="Modifier la tâche"
            description="Toutes les propriétés de votre tâche."
            open={editing}
            onOpenChange={setEditing}
            trigger={<Button>Modifier</Button>}
          >
            <TaskEditor
              key={task.id}
              data={data}
              onSaved={() => setEditing(false)}
            />
          </Sheet>
        </div>
        {mutation.error && (
          <p role="alert" className="field-error">
            {mutation.error}
          </p>
        )}
        <dl className="task-property-list">
          {properties.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {(task.status === "waiting" ||
          task.waiting_for ||
          task.waiting_since ||
          task.follow_up_date) && (
          <div className="task-waiting-summary">
            <h3>Waiting</h3>
            <dl className="task-property-list">
              <div>
                <dt>Waiting for</dt>
                <dd>{task.waiting_for || "Non précisé"}</dd>
              </div>
              <div>
                <dt>Waiting since</dt>
                <dd>{task.waiting_since || "Non définie"}</dd>
              </div>
              <div>
                <dt>Follow-up</dt>
                <dd>{task.follow_up_date || "Non définie"}</dd>
              </div>
            </dl>
          </div>
        )}
        <div className="task-description">
          <h3>Description / notes</h3>
          <p>{task.description || "Aucune description."}</p>
        </div>
        {task.completed_at && (
          <p className="organization-meta">
            Terminée le {task.completed_at.slice(0, 10)}
          </p>
        )}
      </Card>
      <Section
        title="Checklist"
        description="De petits éléments à cocher, distincts des sous-tâches."
      >
        <Checklist data={data} />
      </Section>
      <Section
        title="Sous-tâches"
        description="De vraies actions, avec leur propre statut et leurs dates."
      >
        {!task.parent_task_id && (
          <QuickCapture
            label="Ajouter une sous-tâche"
            defaults={{
              parent_task_id: task.id,
              project_id: task.project_id,
              life_area_id: task.life_area_id,
            }}
          />
        )}
        {task.parent_task_id ? (
          <p>Un seul niveau de sous-tâches est disponible.</p>
        ) : (
          <TaskList tasks={data.subtasks} references={data} />
        )}
      </Section>
    </PageLayout>
  );
}
function TaskEditor({
  data,
  onSaved,
}: {
  data: DetailData;
  onSaved: () => void;
}) {
  const { task } = data,
    mutation = useTaskMutation();
  const hydrated = useHydrated();
  const [projectId, setProjectId] = useState(task.project_id || ""),
    [milestoneId, setMilestoneId] = useState(task.milestone_id || ""),
    [status, setStatus] = useState(task.status);
  const [localError, setLocalError] = useState(""),
    [saved, setSaved] = useState(false);
  const project = data.projects.find((item) => item.id === projectId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLocalError("");
    setSaved(false);
    try {
      const values: TaskInput = {
        title: text(form, "title"),
        description: optional(form, "description"),
        status,
        priority: text(form, "priority") as TaskInput["priority"],
        effort: text(form, "effort") as TaskInput["effort"],
        project_id: projectId || null,
        milestone_id: milestoneId || null,
        life_area_id: projectId ? null : optional(form, "life_area_id"),
        do_date: optional(form, "do_date"),
        deadline: optional(form, "deadline"),
        estimated_minutes:
          text(form, "estimated_minutes") === ""
            ? null
            : Number(text(form, "estimated_minutes")),
        context: optional(form, "context"),
        waiting_for: optional(form, "waiting_for"),
        waiting_since: optional(form, "waiting_since"),
        follow_up_date: optional(form, "follow_up_date"),
      };
      const result = await mutation.run({
        kind: "update",
        id: task.id,
        values,
        remindAt: reminderFromLocal(text(form, "remind_at"), data.timezone),
      });
      if (result) {
        setSaved(true);
        onSaved();
      }
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Données invalides.",
      );
    }
  }
  return (
    <div>
      <form className="organization-form task-detail-form" onSubmit={submit}>
        <fieldset disabled={mutation.busy || !hydrated}>
          <Input
            label="Titre"
            name="title"
            required
            maxLength={300}
            defaultValue={task.title}
          />
          <Textarea
            label="Description"
            name="description"
            maxLength={10000}
            defaultValue={task.description || ""}
          />
          <div className="task-detail-grid">
            <Select
              label="Statut"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              {taskStatuses.map((value) => (
                <option key={value} value={value}>
                  {taskLabels[value]}
                </option>
              ))}
            </Select>
            <Select
              label="Priorité"
              name="priority"
              defaultValue={task.priority}
            >
              {taskPriorities.map((value) => (
                <option key={value} value={value}>
                  {taskLabels[value]}
                </option>
              ))}
            </Select>
            <Select label="Effort" name="effort" defaultValue={task.effort}>
              {taskEfforts.map((value) => (
                <option key={value} value={value}>
                  {taskLabels[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="organization-fields">
            <Input
              label="Do Date"
              name="do_date"
              type="date"
              hint="Jour où vous souhaitez agir."
              defaultValue={task.do_date || ""}
            />
            <Input
              label="Deadline"
              name="deadline"
              type="date"
              hint="Date limite réelle, indépendante du Do Date."
              defaultValue={task.deadline || ""}
            />
          </div>
          <div className="organization-fields">
            <Select
              label="Project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setMilestoneId("");
              }}
            >
              <option value="">Aucun</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Select
              label="Life Area"
              name="life_area_id"
              disabled={!!projectId}
              key={projectId}
              defaultValue={
                projectId
                  ? project?.life_area_id || ""
                  : task.life_area_id || ""
              }
              hint={
                projectId ? "Héritée du Project ; évolue avec lui." : undefined
              }
            >
              <option value="">Aucune</option>
              {data.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
          <Select
            label="Milestone"
            value={milestoneId}
            disabled={!projectId}
            onChange={(event) => setMilestoneId(event.target.value)}
          >
            <option value="">Aucun</option>
            {data.milestones
              .filter((m) => m.project_id === projectId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
          </Select>
          <div className="organization-fields">
            <Input
              label="Durée estimée (minutes)"
              name="estimated_minutes"
              type="number"
              min={0}
              step={1}
              defaultValue={task.estimated_minutes ?? ""}
            />
            <Input
              label="Contexte"
              name="context"
              list="task-contexts"
              defaultValue={task.context || ""}
            />
            <datalist id="task-contexts">
              {taskContexts.map((context) => (
                <option key={context} value={context} />
              ))}
            </datalist>
          </div>
          <Input
            label={`Reminder · ${data.timezone}`}
            name="remind_at"
            type="datetime-local"
            defaultValue={localReminder(
              data.reminder?.remind_at ?? null,
              data.timezone,
            )}
            hint="Rappel enregistré. Les notifications système ne sont pas encore disponibles."
          />
          <details
            className="task-waiting"
            open={status === "waiting" || undefined}
          >
            <summary>Waiting · attente et relance</summary>
            <div className="organization-form">
              <Input
                label="Waiting for"
                name="waiting_for"
                defaultValue={task.waiting_for || ""}
                placeholder="Réponse, personne ou événement attendu"
              />
              <div className="organization-fields">
                <Input
                  label="Waiting since"
                  name="waiting_since"
                  type="date"
                  defaultValue={
                    task.waiting_since ||
                    (status === "waiting" ? data.today : "")
                  }
                />
                <Input
                  label="Follow-up"
                  name="follow_up_date"
                  type="date"
                  defaultValue={task.follow_up_date || ""}
                />
              </div>
              <p className="field-hint">
                Une relance arrivée apparaît dans « À relancer », sans changer
                automatiquement le statut.
              </p>
            </div>
          </details>
        </fieldset>
        {(localError || mutation.error) && (
          <p role="alert" className="field-error">
            {localError || mutation.error}
          </p>
        )}
        {saved && <p role="status">Tâche enregistrée.</p>}
        <div className="organization-actions">
          <Button type="submit" loading={mutation.busy}>
            Enregistrer la tâche
          </Button>
          <Button
            variant="ghost"
            disabled={mutation.busy}
            onClick={() =>
              void mutation.run({
                kind: "archive",
                id: task.id,
                archived: !task.archived_at,
              })
            }
          >
            {task.archived_at ? "Restaurer la tâche" : "Archiver la tâche"}
          </Button>
        </div>
        {task.completed_at && (
          <p className="organization-meta">
            Terminée le {task.completed_at.slice(0, 10)}
          </p>
        )}
      </form>
    </div>
  );
}
function Checklist({ data }: { data: DetailData }) {
  const mutation = useTaskMutation(),
    [label, setLabel] = useState("");
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await mutation.run({ kind: "checklist-add", taskId: data.task.id, label })
    )
      setLabel("");
  }
  async function move(index: number, delta: number) {
    const ids = data.checklist.map((item) => item.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await mutation.run({
      kind: "checklist-reorder",
      taskId: data.task.id,
      ids,
    });
  }
  return (
    <div className="task-checklist">
      {mutation.error && (
        <p role="alert" className="field-error">
          {mutation.error}
        </p>
      )}
      <form onSubmit={add} className="capture-fields">
        <Input
          label="Élément de checklist"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
          maxLength={300}
          disabled={mutation.busy}
        />
        <Button type="submit" loading={mutation.busy}>
          Ajouter à la checklist
        </Button>
      </form>
      {!data.checklist.length && (
        <p className="task-empty">Aucun élément pour le moment.</p>
      )}
      <ul>
        {data.checklist.map((item, index) => (
          <ChecklistRow
            key={`${item.id}:${item.updated_at}`}
            item={item}
            busy={mutation.busy}
            update={async (label, completed) => {
              await mutation.run({
                kind: "checklist-update",
                taskId: data.task.id,
                id: item.id,
                label,
                completed,
              });
            }}
            actions={
              <>
                <Button
                  variant="ghost"
                  disabled={mutation.busy || index === 0}
                  aria-label={`Monter ${item.label}`}
                  onClick={() => void move(index, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  disabled={
                    mutation.busy || index === data.checklist.length - 1
                  }
                  aria-label={`Descendre ${item.label}`}
                  onClick={() => void move(index, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  variant="ghost"
                  disabled={mutation.busy}
                  onClick={() =>
                    void mutation.run({
                      kind: "checklist-remove",
                      taskId: data.task.id,
                      id: item.id,
                    })
                  }
                >
                  Retirer
                </Button>
              </>
            }
          />
        ))}
      </ul>
    </div>
  );
}
function ChecklistRow({
  item,
  busy,
  update,
  actions,
}: {
  item: ChecklistItem;
  busy: boolean;
  update: (label: string, complete: boolean) => Promise<void>;
  actions: import("react").ReactNode;
}) {
  const [editing, setEditing] = useState(false),
    [label, setLabel] = useState(item.label);
  return (
    <li>
      <Checkbox
        label={item.label}
        checked={item.is_completed}
        disabled={busy}
        onChange={(event) => void update(item.label, event.target.checked)}
      />
      <div className="organization-actions">
        {actions}
        <Button
          variant="ghost"
          onClick={() => setEditing(!editing)}
          disabled={busy}
        >
          Renommer
        </Button>
      </div>
      {editing && (
        <form
          className="capture-fields"
          onSubmit={async (event) => {
            event.preventDefault();
            await update(label, item.is_completed);
          }}
        >
          <Input
            label="Libellé"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={300}
          />
          <Button type="submit" disabled={busy}>
            Enregistrer le libellé
          </Button>
        </form>
      )}
    </li>
  );
}
