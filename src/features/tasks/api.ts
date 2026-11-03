import { createServerFn } from "@tanstack/react-start";
import type { TaskCommand } from "../../services/task-service";
import type { TaskFilter } from "../../types/task";
export const getTasks = createServerFn({ method: "GET" })
  .validator((filter: Omit<TaskFilter, "today">) => filter)
  .handler(async ({ data }) => {
    const { withTasks } = await import("../../services/task-service.server");
    return withTasks((service, userId, references) => ({
      ...references,
      tasks: service.list(userId, data),
      today: service.today(),
    }));
  });
export const getTask = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    const { withTasks } = await import("../../services/task-service.server");
    return withTasks((service, userId, references) => ({
      ...references,
      ...service.detail(userId, data),
      today: service.today(),
    }));
  });
export const saveTask = createServerFn({ method: "POST" })
  .validator((command: TaskCommand) => command)
  .handler(async ({ data }) => {
    try {
      const { withTasks } = await import("../../services/task-service.server");
      const { executeTask } = await import("../../services/task-service");
      const id = withTasks(
        (service, userId) => executeTask(service, userId, data),
        { references: false },
      );
      return { ok: true as const, id };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "Enregistrement impossible.",
      };
    }
  });
