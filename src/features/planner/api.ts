import { createServerFn } from "@tanstack/react-start";
import type { PlannerInput, EditScope } from "../../types/planner";
export const getPlanner = createServerFn({ method: "GET" })
  .validator((data: { from: string; to: string }) => data)
  .handler(async ({ data }) => {
    const { readPlanner } = await import(
      "../../services/planner-service.server"
    );
    return readPlanner(data.from, data.to);
  });
type Command =
  | {
      kind: "save";
      id?: string;
      key?: string;
      scope: EditScope;
      values: PlannerInput;
    }
  | { kind: "remove"; id: string; key: string; scope: EditScope };
export const savePlanner = createServerFn({ method: "POST" })
  .validator((data: Command) => data)
  .handler(async ({ data }) => {
    try {
      const { withPlanner } = await import(
        "../../services/planner-service.server"
      );
      const id = withPlanner((service, user) =>
        data.kind === "remove"
          ? service.remove(user.id, data.id, data.key, data.scope)
          : data.id
            ? service.edit(user.id, data.id, data.key!, data.scope, data.values)
            : service.create(user.id, {
                ...data.values,
                timezone: user.timezone,
              }).id,
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
