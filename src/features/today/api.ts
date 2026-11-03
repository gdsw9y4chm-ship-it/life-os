import { createServerFn } from "@tanstack/react-start";
export const getToday = createServerFn({ method: "GET" }).handler(async () => {
  const { readToday } = await import("../../services/today-service.server");
  return readToday();
});
export const getTodayReferences = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readTodayReferences } = await import(
      "../../services/today-service.server"
    );
    return readTodayReferences();
  },
);
