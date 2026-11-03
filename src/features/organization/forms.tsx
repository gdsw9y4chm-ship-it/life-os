import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Button,
  Input,
  Textarea,
  Select,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { saveOrganization } from "./api";
import type { OrganizationCommand } from "../../services/organization-service";
import type {
  LifeArea,
  Goal,
  Project,
  Milestone,
} from "../../types/organization";
import {
  goalTypes,
  goalStatuses,
  projectStatuses,
  progressModes,
  milestoneStatuses,
} from "../../types/organization";
export const labels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  waiting: "Waiting",
  someday: "Someday",
  completed: "Completed",
  archived: "Archived",
  pending: "À faire",
  in_progress: "En cours",
  numeric: "Numérique",
  frequency: "Fréquence",
  duration: "Durée",
  milestones: "Milestones",
  manual: "Manuelle",
  none: "Aucune",
  task_based: "Par tâches (à venir)",
};
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => text(data, key) || null;
const numeric = (data: FormData, key: string) =>
  text(data, key) === "" ? null : Number(text(data, key));
function Options({ values }: { values: readonly string[] }) {
  return values.map((value) => (
    <option key={value} value={value}>
      {labels[value] || value}
    </option>
  ));
}
function Editor({
  title,
  trigger,
  children,
  command,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  command: (data: FormData) => OrganizationCommand;
}) {
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const result = await saveOrganization({ data: command(data) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await router.invalidate();
      setOpen(false);
    } catch {
      setError("Connexion interrompue. Vérifiez vos données puis réessayez.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet
      title={title}
      description="Seul le nom ou titre est obligatoire, sauf indication contraire."
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        if (!saving) {
          setOpen(value);
          setError("");
        }
      }}
    >
      <form className="organization-form" onSubmit={submit}>
        <fieldset disabled={saving}>{children}</fieldset>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="organization-actions">
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
export function AreaEditor({ area }: { area?: LifeArea }) {
  return (
    <Editor
      title={area ? "Modifier la Life Area" : "Nouvelle Life Area"}
      trigger={
        <Button variant={area ? "ghost" : "primary"}>
          {area ? "Modifier" : "Nouvelle Life Area"}
        </Button>
      }
      command={(data) => ({
        kind: "life-area",
        id: area?.id,
        values: {
          name: text(data, "name"),
          description: optional(data, "description"),
          icon: area?.icon ?? null,
          is_archived: text(data, "archive") === "true",
        },
      })}
    >
      <Input
        label="Nom"
        name="name"
        required
        maxLength={300}
        defaultValue={area?.name}
      />
      <Textarea
        label="Description"
        name="description"
        maxLength={10000}
        defaultValue={area?.description || ""}
      />
      {area && (
        <Select
          label="Visibilité"
          name="archive"
          defaultValue={String(area.is_archived)}
        >
          <option value="false">Active</option>
          <option value="true">Archived</option>
        </Select>
      )}
    </Editor>
  );
}
export function GoalEditor({ goal }: { goal?: Goal }) {
  return (
    <Editor
      title={goal ? "Modifier le Goal" : "Nouveau Goal"}
      trigger={
        <Button variant={goal ? "ghost" : "secondary"}>
          {goal ? "Modifier" : "Nouveau Goal"}
        </Button>
      }
      command={(data) => ({
        kind: "goal",
        id: goal?.id,
        values: {
          title: text(data, "title"),
          description: optional(data, "description"),
          type: text(data, "type") as Goal["type"],
          status: text(data, "status") as Goal["status"],
          target_value: numeric(data, "target_value"),
          target_unit: optional(data, "target_unit"),
          target_date: optional(data, "target_date"),
        },
      })}
    >
      <Input
        label="Titre"
        name="title"
        required
        maxLength={300}
        defaultValue={goal?.title}
      />
      <Textarea
        label="Description"
        name="description"
        maxLength={10000}
        defaultValue={goal?.description || ""}
      />
      <div className="organization-fields">
        <Select label="Type" name="type" defaultValue={goal?.type || "manual"}>
          <Options values={goalTypes} />
        </Select>
        <Select
          label="Statut"
          name="status"
          defaultValue={goal?.status || "active"}
        >
          <Options values={goalStatuses} />
        </Select>
      </div>
      <div className="organization-fields">
        <Input
          label="Valeur cible"
          name="target_value"
          type="number"
          min={0}
          step="any"
          defaultValue={goal?.target_value ?? ""}
        />
        <Input
          label="Unité"
          name="target_unit"
          defaultValue={goal?.target_unit || ""}
        />
      </div>
      <Input
        label="Date cible"
        name="target_date"
        type="date"
        defaultValue={goal?.target_date || ""}
      />
    </Editor>
  );
}
export function ProjectEditor({
  project,
  areas,
  goals,
}: {
  project?: Project;
  areas: LifeArea[];
  goals: Goal[];
}) {
  const [mode, setMode] = useState(project?.progress_mode || "none");
  return (
    <Editor
      title={project ? "Modifier le Project" : "Nouveau Project"}
      trigger={
        <Button
          variant={project ? "secondary" : "primary"}
          onClick={() => setMode(project?.progress_mode || "none")}
        >
          {project ? "Modifier le Project" : "Nouveau Project"}
        </Button>
      }
      command={(data) => ({
        kind: "project",
        id: project?.id,
        values: {
          title: text(data, "title"),
          description: optional(data, "description"),
          life_area_id: optional(data, "life_area_id"),
          goal_id: optional(data, "goal_id"),
          status: text(data, "status") as Project["status"],
          start_date: optional(data, "start_date"),
          deadline: optional(data, "deadline"),
          progress_mode: text(
            data,
            "progress_mode",
          ) as Project["progress_mode"],
          manual_progress: numeric(data, "manual_progress"),
        },
      })}
    >
      <Input
        label="Titre"
        name="title"
        required
        maxLength={300}
        defaultValue={project?.title}
      />
      <Textarea
        label="Description"
        name="description"
        maxLength={10000}
        defaultValue={project?.description || ""}
      />
      <div className="organization-fields">
        <Select
          label="Life Area"
          name="life_area_id"
          defaultValue={project?.life_area_id || ""}
        >
          <option value="">Aucune</option>
          {areas
            .filter((a) => !a.is_archived || a.id === project?.life_area_id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_archived ? " · Archived" : ""}
              </option>
            ))}
        </Select>
        <Select
          label="Goal"
          name="goal_id"
          defaultValue={project?.goal_id || ""}
        >
          <option value="">Aucun</option>
          {goals
            .filter((g) => g.status !== "archived" || g.id === project?.goal_id)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
                {g.status === "archived" ? " · Archived" : ""}
              </option>
            ))}
        </Select>
      </div>
      <Select
        label="Statut"
        name="status"
        defaultValue={project?.status || "active"}
      >
        <Options values={projectStatuses} />
      </Select>
      <div className="organization-fields">
        <Input
          label="Date de début"
          name="start_date"
          type="date"
          defaultValue={project?.start_date || ""}
        />
        <Input
          label="Deadline"
          name="deadline"
          type="date"
          defaultValue={project?.deadline || ""}
        />
      </div>
      <Select
        label="Mode de progression"
        name="progress_mode"
        value={mode}
        onChange={(event) =>
          setMode(event.target.value as Project["progress_mode"])
        }
      >
        <Options values={progressModes} />
      </Select>
      {mode === "manual" && (
        <Input
          label="Progression (%)"
          name="manual_progress"
          type="number"
          min={0}
          max={100}
          step="any"
          required
          defaultValue={project?.manual_progress ?? 0}
        />
      )}
      {mode === "task_based" && (
        <p className="field-hint">
          Disponible lorsque les tâches seront intégrées.
        </p>
      )}
    </Editor>
  );
}
export function MilestoneEditor({
  projectId,
  milestone,
}: {
  projectId: string;
  milestone?: Milestone;
}) {
  return (
    <Editor
      title={milestone ? "Modifier le Milestone" : "Nouveau Milestone"}
      trigger={
        <Button variant={milestone ? "ghost" : "secondary"}>
          {milestone ? "Modifier" : "Nouveau Milestone"}
        </Button>
      }
      command={(data) => ({
        kind: "milestone",
        id: milestone?.id,
        projectId,
        values: {
          title: text(data, "title"),
          description: optional(data, "description"),
          status: text(data, "status") as Milestone["status"],
          target_date: optional(data, "target_date"),
        },
      })}
    >
      <Input
        label="Titre"
        name="title"
        required
        maxLength={300}
        defaultValue={milestone?.title}
      />
      <Textarea
        label="Description"
        name="description"
        maxLength={10000}
        defaultValue={milestone?.description || ""}
      />
      <Select
        label="Statut"
        name="status"
        defaultValue={milestone?.status || "pending"}
      >
        <Options values={milestoneStatuses} />
      </Select>
      <Input
        label="Date cible"
        name="target_date"
        type="date"
        defaultValue={milestone?.target_date || ""}
      />
    </Editor>
  );
}
