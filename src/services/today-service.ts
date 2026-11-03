import type { TodayData, TodayRepository } from "../types/today";
import type { User } from "../types/user";
import { taskPriorities } from "../types/task";
import { calendarDay } from "./task-rules";

export class TodayService {
  constructor(
    private readonly repository: TodayRepository,
    private readonly now = () => new Date(),
  ) {}
  read(user: User): TodayData {
    const instant = this.now();
    const day = calendarDay(instant, user.timezone);
    const todayTasks = this.repository.todayTasks(user.id, day);
    const projects = this.repository.activeProjects(user.id, day);
    const ids = projects.map((project) => project.id);
    const tasks = new Map(
      this.repository
        .taskAggregates(user.id, ids)
        .map((row) => [row.project_id, row]),
    );
    const milestones = new Map(
      this.repository
        .milestoneAggregates(
          user.id,
          projects
            .filter((p) => p.progress_mode === "milestones")
            .map((p) => p.id),
        )
        .map((row) => [row.project_id, row]),
    );
    return {
      user,
      day,
      dateLabel: new Intl.DateTimeFormat(user.locale, {
        timeZone: user.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(instant),
      todayTasks,
      groups: taskPriorities
        .map((priority) => ({
          priority,
          tasks: todayTasks.filter((task) => task.priority === priority),
        }))
        .filter((group) => group.tasks.length),
      mustCount: todayTasks.filter((task) => task.priority === "must").length,
      followUps: this.repository.followUps(user.id, day),
      ...this.repository.counts(user.id, day),
      activeProjects: projects.map((project) => {
        const aggregate =
          project.progress_mode === "milestones"
            ? milestones.get(project.id)
            : tasks.get(project.id);
        const progress =
          project.progress_mode === "none"
            ? null
            : project.progress_mode === "manual"
              ? project.manual_progress
              : aggregate?.total
                ? Math.round((100 * aggregate.done) / aggregate.total)
                : null;
        return {
          ...project,
          progress,
          openTaskCount: tasks.get(project.id)?.open_count ?? 0,
        };
      }),
    };
  }
}
