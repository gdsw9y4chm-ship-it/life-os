import { TaskList, QuickCapture } from "../tasks/components";
import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowUp, ArrowDown, Layers } from "lucide-react";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  Section,
} from "../../design-system/components/primitives";
import { Tabs } from "../../design-system/components/overlays";
import { AngelWings, Diamond } from "../../design-system/components/ornaments";
import {
  AreaEditor,
  GoalEditor,
  ProjectEditor,
  MilestoneEditor,
  labels,
} from "./forms";
import { saveOrganization } from "./api";
import type { OrganizationService } from "../../services/organization-service";
type Snapshot = ReturnType<OrganizationService["snapshot"]>;
type Detail = ReturnType<OrganizationService["detail"]>;
function Blank({ title, children }: { title: string; children: string }) {
  return (
    <div className="organization-empty">
      <AngelWings />
      <EmptyState icon={<Diamond />} title={title}>
        {children}
      </EmptyState>
    </div>
  );
}
export function OrganizationError() {
  return (
    <PageLayout title="Votre espace" subtitle="Le chargement n’a pas abouti.">
      <Card>
        <p role="alert">
          Les données sont indisponibles ou cet élément n’existe plus. Aucun
          changement n’a été enregistré.
        </p>
        <Button onClick={() => window.location.reload()}>Réessayer</Button>
        <Link to="/projects">Retour aux Projects</Link>
      </Card>
    </PageLayout>
  );
}
export function LifeView({ data }: { data: Snapshot }) {
  const [archives, setArchives] = useState(false);
  const areas = data.areas.filter((area) => area.is_archived === archives);
  return (
    <PageLayout
      title="Life"
      subtitle="Les domaines qui comptent pour vous, et les résultats que vous souhaitez atteindre."
    >
      <Tabs
        label="Organisation de Life"
        tabs={[
          {
            value: "areas",
            label: "Life Areas",
            content: (
              <>
                <div className="organization-toolbar">
                  <p>Vos domaines permanents, à votre rythme.</p>
                  <AreaEditor />
                </div>
                <div className="organization-actions">
                  <Button
                    variant={archives ? "ghost" : "secondary"}
                    onClick={() => setArchives(false)}
                  >
                    Actives
                  </Button>
                  <Button
                    variant={archives ? "secondary" : "ghost"}
                    onClick={() => setArchives(true)}
                  >
                    Archives
                  </Button>
                </div>
                {areas.length ? (
                  <div className="organization-grid">
                    {areas.map((area) => (
                      <Card key={area.id}>
                        <div className="organization-item-heading">
                          <Layers size={18} aria-hidden="true" />
                          <h2>{area.name}</h2>
                        </div>
                        {area.description && (
                          <p className="organization-description">
                            {area.description}
                          </p>
                        )}
                        <div className="organization-row">
                          <Badge>
                            {area.is_archived ? "Archived" : "Life Area"}
                          </Badge>
                          <Link
                            to="/tasks"
                            search={{
                              view: "all",
                              area: area.id,
                              project: "",
                              q: "",
                              context: "",
                            }}
                          >
                            Voir les tâches
                          </Link>
                          <AreaEditor area={area} />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Blank
                    title={
                      archives
                        ? "Aucune Life Area archivée"
                        : "Un espace pour chaque dimension de votre vie"
                    }
                  >
                    Créez vos domaines puis retrouvez-les ici.
                  </Blank>
                )}
              </>
            ),
          },
          {
            value: "goals",
            label: "Goals",
            content: (
              <>
                <div className="organization-toolbar">
                  <p>
                    Des résultats souhaités, sans obligation de créer un projet.
                  </p>
                  <GoalEditor />
                </div>
                {data.goals.length ? (
                  <div className="organization-grid">
                    {data.goals.map((goal) => (
                      <Card key={goal.id}>
                        <div className="organization-item-heading">
                          <Diamond />
                          <h2>{goal.title}</h2>
                        </div>
                        {goal.description && (
                          <p className="organization-description">
                            {goal.description}
                          </p>
                        )}
                        <p className="organization-meta">
                          {labels[goal.type]}
                          {goal.target_value !== null &&
                            ` · ${goal.target_value} ${goal.target_unit || ""}`}
                          {goal.target_date && ` · ${goal.target_date}`}
                        </p>
                        <div className="organization-row">
                          <Badge
                            tone={goal.status === "active" ? "rose" : "neutral"}
                          >
                            {labels[goal.status]}
                          </Badge>
                          <GoalEditor goal={goal} />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Blank title="Quel résultat souhaitez-vous atteindre ?">
                    Votre premier Goal peut commencer par une simple intention.
                  </Blank>
                )}
              </>
            ),
          },
        ]}
      />
    </PageLayout>
  );
}
export function ProjectsView({ data }: { data: Snapshot }) {
  const groups = [
    { title: "Active", statuses: ["active"] },
    { title: "Paused / Waiting", statuses: ["paused", "waiting"] },
    { title: "Someday", statuses: ["someday"] },
    { title: "Completed / Archived", statuses: ["completed", "archived"] },
  ];
  return (
    <PageLayout
      title="Projects"
      subtitle="Donnez une place à ce que vous souhaitez concrétiser."
      actions={<ProjectEditor areas={data.areas} goals={data.goals} />}
    >
      {!data.projects.length && (
        <Blank title="De l’intention au projet">
          Créez votre premier projet. Un titre suffit pour commencer.
        </Blank>
      )}
      {groups.map((group) => (
        <Section key={group.title} title={group.title}>
          <div className="organization-grid">
            {data.projects
              .filter((project) => group.statuses.includes(project.status))
              .map((project) => (
                <Card key={project.id}>
                  <h2>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                    >
                      {project.title}
                    </Link>
                  </h2>
                  {project.description && (
                    <p className="organization-description">
                      {project.description}
                    </p>
                  )}
                  <p className="organization-meta">
                    {data.areas.find((area) => area.id === project.life_area_id)
                      ?.name || "Sans Life Area"}
                    {project.deadline && ` · ${project.deadline}`}
                  </p>
                  <div className="organization-row">
                    <Badge
                      tone={project.status === "active" ? "rose" : "neutral"}
                    >
                      {labels[project.status]}
                    </Badge>
                    <ProjectEditor
                      project={project}
                      areas={data.areas}
                      goals={data.goals}
                    />
                  </div>
                </Card>
              ))}
          </div>
          {!data.projects.some((project) =>
            group.statuses.includes(project.status),
          ) && (
            <p className="organization-meta">
              Aucun projet dans cette section.
            </p>
          )}
        </Section>
      ))}
    </PageLayout>
  );
}
export function ProjectDetailView({
  data,
  detail,
}: {
  data: Snapshot;
  detail: Detail;
}) {
  const { project, milestones, progress } = detail;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function move(index: number, delta: number) {
    if (busy) return;
    const ids = milestones.map((item) => item.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    setBusy(true);
    setError("");
    try {
      const result = await saveOrganization({
        data: { kind: "reorder-milestones", projectId: project.id, ids },
      });
      if (!result.ok) setError(result.error);
      else await router.invalidate();
    } catch {
      setError("Impossible de modifier l’ordre. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageLayout
      title="Projects"
      subtitle="Un projet, ses liens et ses étapes."
      actions={
        <ProjectEditor
          project={project}
          areas={data.areas}
          goals={data.goals}
        />
      }
    >
      <Link className="organization-back" to="/projects">
        ← Tous les Projects
      </Link>
      <Card className="project-overview">
        <div className="organization-row">
          <h2>{project.title}</h2>
          <Badge tone="rose">{labels[project.status]}</Badge>
        </div>
        {project.description && (
          <p className="organization-description">{project.description}</p>
        )}
        <dl className="organization-details">
          <div>
            <dt>Life Area</dt>
            <dd>
              {data.areas.find((area) => area.id === project.life_area_id)
                ?.name || "Aucune"}
            </dd>
          </div>
          <div>
            <dt>Goal</dt>
            <dd>
              {data.goals.find((goal) => goal.id === project.goal_id)?.title ||
                "Aucun"}
            </dd>
          </div>
          <div>
            <dt>Début</dt>
            <dd>{project.start_date || "Non défini"}</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{project.deadline || "Non définie"}</dd>
          </div>
        </dl>
        {progress !== null ? (
          <Progress label={`Progression · ${progress} %`} value={progress} />
        ) : (
          <p className="organization-meta">
            {project.progress_mode === "task_based"
              ? "Aucune tâche pertinente pour calculer la progression."
              : project.progress_mode === "milestones"
                ? "Ajoutez un milestone pour commencer le suivi."
                : "Aucune progression suivie."}
          </p>
        )}
      </Card>
      <Section
        title="Tasks"
        description="Les actions de ce projet, avec leurs propres statuts."
      >
        <QuickCapture defaults={{ project_id: project.id }} />
        <h3>Tâches ouvertes</h3>
        <TaskList
          tasks={detail.tasks.filter((task) => task.status !== "done")}
          references={data}
        />
        <h3>Tâches terminées</h3>
        <TaskList
          tasks={detail.tasks.filter((task) => task.status === "done")}
          references={data}
        />
      </Section>
      <Section
        title="Milestones"
        description="Les étapes concrètes de ce projet."
      >
        <div className="organization-toolbar">
          <span>
            {milestones.length} étape{milestones.length !== 1 ? "s" : ""}
          </span>
          <MilestoneEditor projectId={project.id} />
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {!milestones.length ? (
          <Blank title="Une première étape">
            Décomposez ce projet à votre rythme.
          </Blank>
        ) : (
          <ol className="milestone-list">
            {milestones.map((milestone, index) => (
              <li key={milestone.id}>
                <Card>
                  <div className="organization-item-heading">
                    <Diamond />
                    <h3>{milestone.title}</h3>
                  </div>
                  {milestone.description && (
                    <p className="organization-description">
                      {milestone.description}
                    </p>
                  )}
                  <div className="organization-row">
                    <Badge
                      tone={
                        milestone.status === "completed" ? "rose" : "neutral"
                      }
                    >
                      {labels[milestone.status]}
                    </Badge>
                    {milestone.target_date && (
                      <span className="organization-meta">
                        {milestone.target_date}
                      </span>
                    )}
                    <div className="organization-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Monter ${milestone.title}`}
                        disabled={busy || index === 0}
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Descendre ${milestone.title}`}
                        disabled={busy || index === milestones.length - 1}
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <MilestoneEditor
                        projectId={project.id}
                        milestone={milestone}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </PageLayout>
  );
}
