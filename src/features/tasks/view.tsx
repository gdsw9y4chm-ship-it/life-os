import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Input,
  Select,
  Section,
  Button,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { QuickCapture, TaskList, taskLabels } from "./components";
import { taskContexts, taskPriorities, taskEfforts } from "../../types/task";
import type { TaskView, TaskPriority, TaskEffort } from "../../types/task";
import type { getTasks } from "./api";
export type TaskData = Awaited<ReturnType<typeof getTasks>>;
export type TaskSearch = {
  view: TaskView;
  context: string;
  q: string;
  project: string;
  area: string;
  priority?: TaskPriority | "";
  effort?: TaskEffort | "";
};
const groups: { label: string; views: TaskView[] }[] = [
  { label: "Focus", views: ["inbox", "today", "upcoming"] },
  { label: "Suivi", views: ["waiting", "follow-ups", "overdue"] },
  {
    label: "Plus",
    views: ["someday", "unscheduled", "completed", "all", "archived"],
  },
];
export function TasksView({
  data,
  search,
  onFilter,
}: {
  data: TaskData;
  search: TaskSearch;
  onFilter: (next: Partial<TaskSearch>) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const contextOptions = Array.from(
    new Set([
      ...taskContexts,
      ...(search.context ? [search.context] : []),
      ...data.tasks.flatMap((task) => (task.context ? [task.context] : [])),
    ]),
  );
  // These presentation filters refine the server's existing scoped Smart List, without changing domain rules.
  const tasks = data.tasks.filter(
    (task) =>
      (!search.priority || task.priority === search.priority) &&
      (!search.effort || task.effort === search.effort),
  );
  const filterCount = [
    search.context,
    search.priority,
    search.project,
    search.area,
    search.effort,
  ].filter(Boolean).length;
  const fromMore = !groups[0].views.includes(search.view);
  const area = data.areas.find((item) => item.id === search.area),
    project = data.projects.find((item) => item.id === search.project);
  function views(values: TaskView[], close?: () => void) {
    return values.map((view) => (
      <Link
        key={view}
        to="/tasks"
        search={{ ...search, view }}
        aria-current={view === search.view ? "page" : undefined}
        onClick={close}
      >
        {taskLabels[view]}
      </Link>
    ));
  }
  return (
    <PageLayout
      title="Tasks"
      subtitle="Capturer, clarifier, avancer. Une action à la fois."
    >
      <div className="tasks-layout">
        <nav
          className="task-navigation task-navigation--desktop"
          aria-label="Smart Lists"
        >
          {groups.map((group) => (
            <div className="task-nav-group" key={group.label}>
              <p>{group.label}</p>
              {views(group.views)}
            </div>
          ))}
        </nav>
        <nav
          className="task-navigation task-navigation--mobile"
          aria-label="Smart Lists"
        >
          {views(groups[0].views)}
          <Sheet
            title="Toutes les Smart Lists"
            description="Retrouvez vos vues de suivi et vos autres listes."
            open={moreOpen}
            onOpenChange={setMoreOpen}
            trigger={
              <Button
                variant="ghost"
                className={fromMore ? "task-more is-active" : "task-more"}
                aria-label={
                  fromMore ? `Plus · ${taskLabels[search.view]}` : "Plus"
                }
              >
                Plus{fromMore && <span aria-hidden="true"> ·</span>}
              </Button>
            }
          >
            <nav
              className="task-navigation task-more-navigation"
              aria-label="Autres Smart Lists"
            >
              {groups.slice(1).map((group) => (
                <div className="task-nav-group" key={group.label}>
                  <p>{group.label}</p>
                  {views(group.views, () => setMoreOpen(false))}
                </div>
              ))}
            </nav>
          </Sheet>
        </nav>
        <div className="tasks-content">
          <h2>
            {taskLabels[search.view]}
            {area ? ` · ${area.name}` : ""}
            {project ? ` · ${project.title}` : ""}
          </h2>
          {search.view === "inbox" && (
            <QuickCapture
              defaults={{
                project_id: search.project || null,
                life_area_id: search.project ? null : search.area || null,
              }}
            />
          )}
          <div className="task-search-toolbar">
            <Input
              label="Rechercher les tâches"
              type="search"
              value={search.q}
              onChange={(event) => onFilter({ q: event.target.value })}
              placeholder="Search · titre ou description"
            />
            <Sheet
              title="Filtres des tâches"
              description="Affinez la liste actuelle. Les filtres restent actifs lorsque vous changez de vue."
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              trigger={
                <Button variant={filterCount ? "primary" : "secondary"}>
                  Filters{filterCount ? ` · ${filterCount}` : ""}
                </Button>
              }
            >
              <div className="organization-form">
                <Select
                  label="Contexte"
                  value={search.context}
                  onChange={(event) =>
                    onFilter({ context: event.target.value })
                  }
                >
                  <option value="">Tous les contextes</option>
                  {contextOptions.map((context) => (
                    <option key={context}>{context}</option>
                  ))}
                </Select>
                <Select
                  label="Priorité"
                  value={search.priority || ""}
                  onChange={(event) =>
                    onFilter({
                      priority: event.target.value as TaskSearch["priority"],
                    })
                  }
                >
                  <option value="">Toutes les priorités</option>
                  {taskPriorities.map((value) => (
                    <option key={value} value={value}>
                      {taskLabels[value]}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Project"
                  value={search.project}
                  onChange={(event) =>
                    onFilter({ project: event.target.value })
                  }
                >
                  <option value="">Tous les projets</option>
                  {data.projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Life Area"
                  value={search.area}
                  onChange={(event) => onFilter({ area: event.target.value })}
                >
                  <option value="">Tous les domaines</option>
                  {data.areas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Effort"
                  value={search.effort || ""}
                  onChange={(event) =>
                    onFilter({
                      effort: event.target.value as TaskSearch["effort"],
                    })
                  }
                >
                  <option value="">Tous les efforts</option>
                  {taskEfforts.map((value) => (
                    <option key={value} value={value}>
                      {taskLabels[value]}
                    </option>
                  ))}
                </Select>
                <div className="organization-actions">
                  <Button onClick={() => setFiltersOpen(false)}>
                    Voir les résultats
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      onFilter({
                        context: "",
                        priority: "",
                        project: "",
                        area: "",
                        effort: "",
                      })
                    }
                  >
                    Réinitialiser les filtres
                  </Button>
                </div>
              </div>
            </Sheet>
          </div>
          {filterCount > 0 && (
            <p className="task-active-filters">
              {filterCount} filtre{filterCount > 1 ? "s" : ""} actif
              {filterCount > 1 ? "s" : ""}
              {search.priority ? ` · ${taskLabels[search.priority]}` : ""}
              {search.effort ? ` · ${taskLabels[search.effort]}` : ""}
              {search.context ? ` · ${search.context}` : ""}
            </p>
          )}
          <p className="organization-meta" role="status">
            {tasks.length} tâche{tasks.length !== 1 ? "s" : ""} · ≈{" "}
            {tasks.reduce(
              (sum, task) => sum + (task.estimated_minutes ?? 0),
              0,
            )}{" "}
            min estimées
            {tasks.some((task) => task.estimated_minutes === null)
              ? " · certaines durées non renseignées"
              : ""}
          </p>
          {search.view === "today" ? (
            taskPriorities.map((priority) => (
              <Section
                key={priority}
                title={
                  priority === "none" ? "No priority" : taskLabels[priority]
                }
              >
                <TaskList
                  tasks={tasks.filter((task) => task.priority === priority)}
                  references={data}
                />
              </Section>
            ))
          ) : (
            <TaskList tasks={tasks} references={data} />
          )}
        </div>
      </div>
    </PageLayout>
  );
}
