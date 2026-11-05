import { createServerFn } from "@tanstack/react-start";
import type { PracticeCommand } from "../../types/practices";
export const getPractices = createServerFn({ method: "GET" })
  .validator(
    (v: {
      day?: string;
      archived?: boolean;
      routineId?: string;
      runId?: string;
    }) => v,
  )
  .handler(async ({ data }) => {
    const { withPractice } = await import(
      "../../services/practice-service.server"
    );
    return withPractice((s, u) =>
      s.read(
        u,
        data.day || undefined,
        data.archived,
        data.routineId,
        data.runId,
      ),
    );
  });
export const savePractice = createServerFn({ method: "POST" })
  .validator((v: PracticeCommand) => v)
  .handler(async ({ data }) => {
    try {
      const { withPractice } = await import(
        "../../services/practice-service.server"
      );
      const id = withPractice((s, u) => s.execute(u, data));
      return { ok: true as const, id };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Enregistrement impossible.",
      };
    }
  });
export const getTodayPractices = createServerFn({ method: "GET" }).handler(
  async () => {
    const { withPractice } = await import(
      "../../services/practice-service.server"
    );
    return withPractice((s, u) => s.todaySummary(u));
  },
);
