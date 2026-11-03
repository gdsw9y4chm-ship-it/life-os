import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowUpRight, Inbox, CalendarDays, ArrowRight } from "lucide-react";
import { AngelWings, Diamond } from "../../design-system/components/ornaments";
import { Button, Progress } from "../../design-system/components/primitives";
import { TaskList } from "../tasks/components";
import { getTodayReferences } from "./api";
import { calendarDay } from "../../services/task-rules";
import type { Occurrence } from "../../types/planner";
import type { TodayData } from "../../types/today";
import type { TaskReferences, TaskView } from "../../types/task";

const taskSearch = (view: TaskView) => ({
  view,
  context: "",
  q: "",
  project: "",
  area: "",
});

export function TodayView({
  data,
}: {
  data: TodayData & { planning?: Occurrence[] };
}) {
  const router = useRouter();
  const [references, setReferences] = useState<TaskReferences | null>(null);
  const [referenceError, setReferenceError] = useState("");
  const loadingReferences = useRef(false);
  async function loadReferences() {
    if (references || loadingReferences.current) return;
    loadingReferences.current = true;
    setReferenceError("");
    try {
      setReferences(await getTodayReferences());
    } catch {
      setReferenceError("Impossible de charger les choix. Réessayez.");
    } finally {
      loadingReferences.current = false;
    }
  }
  useEffect(() => {
    // Re-evaluate the profile's day after midnight or when returning to the tab.
    const checkDay = () => {
      if (
        document.visibilityState === "visible" &&
        calendarDay(new Date(), data.user.timezone) !== data.day
      )
        void router.invalidate();
    };
    const refresh = () => {
      if (document.visibilityState === "visible") void router.invalidate();
    };
    const interval = window.setInterval(checkDay, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [data.day, data.user.timezone, router]);
  const overview = [
    {
      count: data.todayTasks.length,
      label: "Tâches du jour",
      view: "today" as const,
    },
    { count: data.mustCount, label: "Must", view: "today" as const },
    {
      count: data.followUpCount,
      label: "Relances dues",
      view: "follow-ups" as const,
    },
  ];
  return (
    <div className="page-layout today-page">
      <header className="today-header">
        <div className="today-heading">
          <p className="eyebrow">Bonjour {data.user.name}</p>
          <h1>Today</h1>
          <p className="today-date">
            <time dateTime={data.day}>{data.dateLabel}</time>
          </p>
        </div>
        <AngelWings className="today-wings" />
      </header>
      <nav className="today-overview" aria-label="Résumé du jour">
        {overview.map((item) => (
          <Link
            key={item.label}
            to="/tasks"
            search={taskSearch(item.view)}
            aria-label={`${item.label} : ${item.count}`}
          >
            <strong>{item.count}</strong>
            <span>{item.label}</span>
          </Link>
        ))}
        <Link
          to="/projects"
          aria-label={`Projets liés au jour : ${data.todayProjectCount}`}
        >
          <strong>{data.todayProjectCount}</strong>
          <span>Projets liés au jour</span>
        </Link>
      </nav>
      <div className="today-grid">
        <div className="today-main">
          <section className="today-focus" aria-labelledby="today-focus-title">
            <div className="today-section-heading">
              <h2 id="today-focus-title">Focus du jour</h2>
              <Link to="/tasks" search={taskSearch("all")}>
                Toutes les tâches <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {referenceError && (
              <div role="alert" className="field-error">
                {referenceError}{" "}
                <Button variant="ghost" onClick={() => void loadReferences()}>
                  Réessayer
                </Button>
              </div>
            )}
            <TaskList
              tasks={data.todayTasks}
              groups={data.groups}
              references={references ?? { projects: [], areas: [] }}
              onQuickActionsOpen={() => void loadReferences()}
              referencesReady={!!references}
              emptyState={
                <div className="today-empty">
                  <Diamond />
                  <div>
                    <h3>Votre journée peut respirer.</h3>
                    <p>
                      Aucune tâche prévue aujourd’hui. Retrouvez vos actions
                      dans Tasks ou capturez une idée avec +.
                    </p>
                    <Link to="/tasks" search={taskSearch("unscheduled")}>
                      Choisir une tâche{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              }
            />
          </section>
          {data.followUpCount > 0 && (
            <section
              className="today-follow-ups"
              aria-labelledby="today-follow-title"
            >
              <div className="today-section-heading">
                <h2 id="today-follow-title">À relancer</h2>
                <Link to="/tasks" search={taskSearch("follow-ups")}>
                  Tout voir · {data.followUpCount}
                </Link>
              </div>
              <ul>
                {data.followUps.map((task) => (
                  <li key={task.id}>
                    <Link to="/tasks/$taskId" params={{ taskId: task.id }}>
                      <span>
                        <strong>{task.title}</strong>
                        <span className="today-follow-detail">
                          En attente : {task.waiting_for || "à préciser"}
                        </span>
                        <span className="today-follow-date">
                          {task.follow_up_date === data.day
                            ? "Relance aujourd’hui"
                            : `Relance depuis le ${new Intl.DateTimeFormat(data.user.locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(task.follow_up_date + "T12:00:00Z"))}`}
                        </span>
                      </span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.overdueCount > 0 && (
            <Link
              className="today-overdue"
              to="/tasks"
              search={taskSearch("overdue")}
            >
              <span>
                {data.overdueCount} tâche{data.overdueCount > 1 ? "s" : ""} en
                retard <span>· Faire le point</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <aside className="today-secondary" aria-label="Projets et captures">
          <section aria-labelledby="today-projects-title">
            <div className="today-section-heading">
              <h2 id="today-projects-title">Projets en cours</h2>
              <Link to="/projects">Voir tous</Link>
            </div>
            {data.activeProjects.length ? (
              <ul className="today-projects">
                {data.activeProjects.map((project) => (
                  <li key={project.id}>
                    <Link
                      className="today-project"
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                    >
                      <span className="today-project-area">
                        {project.life_area_name || "Sans Life Area"}
                        {project.today_task_count > 0 && (
                          <span> · Aujourd’hui</span>
                        )}
                      </span>
                      <h3>{project.title}</h3>
                      <span className="today-project-meta">
                        {project.openTaskCount} tâche
                        {project.openTaskCount !== 1 ? "s" : ""} ouverte
                        {project.openTaskCount !== 1 ? "s" : ""}
                      </span>
                      {project.progress !== null && (
                        <Progress
                          value={project.progress}
                          label={`Progression · ${project.progress} %`}
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="today-muted">Aucun projet actif pour le moment.</p>
            )}
          </section>
          {data.inboxCount > 0 && (
            <Link
              className="today-inbox"
              to="/tasks"
              search={taskSearch("inbox")}
            >
              <Inbox size={20} aria-hidden="true" />
              <span>
                <strong>
                  {data.inboxCount} élément{data.inboxCount > 1 ? "s" : ""} à
                  clarifier
                </strong>
                <span>Ouvrir Inbox</span>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
          <TodayPlanning
            items={data.planning ?? []}
            day={data.day}
            timezone={data.user.timezone}
            locale={data.user.locale}
          />
        </aside>
      </div>
    </div>
  );
}
function TodayPlanning({
  items,
  day,
  timezone,
  locale,
}: {
  items: Occurrence[];
  day: string;
  timezone: string;
  locale: string;
}) {
  const clock = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  return (
    <section className="today-planning" aria-label="Planning du jour">
      <CalendarDays size={17} aria-hidden="true" />
      <div>
        <h2>Planning du jour</h2>
        {items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.series.id + item.key}>
                <Link to="/planner" search={{ day, view: "day" }}>
                  {clock(item.start)}–{clock(item.end)} · {item.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucun créneau prévu aujourd’hui.</p>
        )}
        <Link to="/planner" search={{ day, view: "day" }}>
          Ouvrir Planner
        </Link>
      </div>
    </section>
  );
}
