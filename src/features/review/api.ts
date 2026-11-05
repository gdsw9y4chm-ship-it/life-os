import { createServerFn } from "@tanstack/react-start";
import type { ReviewMode, ResetCommand } from "../../types/review";
export const getReview = createServerFn({ method: "GET" })
  .validator((v: { mode: ReviewMode; day?: string; runId?: string }) => v)
  .handler(async ({ data }) => {
    const { withReview } = await import("../../services/review-service.server");
    return withReview((s, u) => s.read(u, data.mode, data.day, data.runId));
  });
export const saveReset = createServerFn({ method: "POST" })
  .validator((v: ResetCommand) => v)
  .handler(async ({ data }) => {
    try {
      const { withReview } = await import(
        "../../services/review-service.server"
      );
      return {
        ok: true as const,
        id: withReview((s, u) => s.execute(u, data)),
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Enregistrement impossible.",
      };
    }
  });
