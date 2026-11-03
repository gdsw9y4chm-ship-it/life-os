import { createServerFn } from "@tanstack/react-start";
import type { OrganizationCommand } from "../../services/organization-service";
export const getOrganization = createServerFn({ method: "GET" }).handler(
  async () => {
    const { withOrganization } = await import(
      "../../services/organization-service.server"
    );
    return withOrganization((service, userId) => service.snapshot(userId));
  },
);
export const getProjectDetail = createServerFn({ method: "GET" })
  .validator((id: string) => {
    if (typeof id !== "string" || !id) throw new Error("Projet requis.");
    return id;
  })
  .handler(async ({ data }) => {
    const { withOrganization } = await import(
      "../../services/organization-service.server"
    );
    return withOrganization((service, userId) => service.detail(userId, data));
  });
export const saveOrganization = createServerFn({ method: "POST" })
  .validator((command: OrganizationCommand) => command)
  .handler(async ({ data }) => {
    try {
      const { withOrganization } = await import(
        "../../services/organization-service.server"
      );
      withOrganization((service, userId) => service.execute(userId, data));
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "Enregistrement impossible.",
      };
    }
  });
