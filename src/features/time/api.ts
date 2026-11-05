import { createServerFn } from "@tanstack/react-start";
import type { TimeCommand } from "../../types/time";
export const getTime = createServerFn({ method: "GET" }).handler(async () => {
  const { withTime } = await import("../../services/time-service.server");
  return withTime((s, u) => s.snapshot(u.id, u.timezone));
});
export const saveTime = createServerFn({ method: "POST" })
  .validator((v: TimeCommand) => v)
  .handler(async ({ data }) => {
    try {
      if (!["start","manual","pause","resume","stop"].includes(data.kind)) throw new Error("Commande Timer invalide.");
      const { withTime } = await import("../../services/time-service.server");
      const id = withTime((s, u) =>
        data.kind === "start"
          ? s.start(u.id, data.values)
          : data.kind === "manual"
            ? s.manual(u.id, data.values)
            : s[data.kind](u.id, data.id),
      );
      return { ok: true as const, id };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Timer indisponible.",
      };
    }
  });
