import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  execFileSync("bun", ["scripts/today-browser-fixture.ts", "empty"], {
    env: process.env,
  });
  errors.set(page, []);
  page.on("pageerror", (e) => errors.get(page)!.push(e.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: real Week Insights and Weekly Reset actions, notes, priorities and persistence`, async ({
    page,
  }) => {
    execFileSync("bun", ["scripts/review-browser-fixture.ts"], {
      env: process.env,
    });
    await page.setViewportSize({ width, height });
    await page.goto("/review");
    await expect(
      page.getByText("0 h 25", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Life Balance", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Lire au calme", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Commencer le Reset" }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/phase-10-insights-${device}.png`,
      fullPage: device === "desktop",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Commencer le Reset" }).click();
    const panel = page.getByRole("region", { name: "Étape du Reset" });
    await expect(
      panel.getByRole("heading", { name: "Inbox", exact: true }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(
      panel.getByRole("link", { name: "Clarifier mon idée", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByLabel("Notes de cette étape")
      .fill("Une décision conservée");
    await expect(
      panel.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    page.once("dialog", (d) => void d.dismiss());
    await page
      .getByRole("link", {
        name: "Revenir aux Insights · progression conservée",
      })
      .click();
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Enregistrer la note" }).click();
    await expect(
      panel.getByRole("button", { name: "Done", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await expect(panel.getByLabel("Notes de cette étape")).toHaveValue(
      "Une décision conservée",
    );
    await expect(
      panel.getByRole("button", { name: "Done", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("heading", { name: "Weekly Reset", exact: true })
      .click();
    await page.screenshot({
      path: `artifacts/phase-10-weekly-reset-${device}.png`,
      fullPage: device === "desktop",
    });
    for (const title of [
      "Inbox",
      "Overdue",
      "Waiting",
      "Projects",
      "Habits",
      "Time Review",
    ]) {
      await expect(
        panel.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await panel
        .getByRole("button", {
          name: title === "Overdue" ? "Skip" : "Done",
          exact: true,
        })
        .click();
    }
    await expect(
      panel.getByRole("heading", { name: "Weekly Priorities", exact: true }),
    ).toBeVisible();
    await panel
      .getByLabel("Priorité 1", { exact: true })
      .fill("Finir mon projet");
    await panel
      .getByLabel("Priorité 2", { exact: true })
      .fill("Garder du temps pour lire");
    await panel
      .getByRole("button", { name: "Enregistrer les priorités" })
      .click();
    await expect(
      panel.getByText("2 priorité(s) enregistrée(s)", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Done", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await expect(panel.getByLabel("Priorité 1", { exact: true })).toHaveValue(
      "Finir mon projet",
    );
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      panel.getByRole("link", { name: /Planifier/ }),
    ).toHaveAttribute("href", /planner/);
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Votre bilan est conservé" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Votre bilan est conservé" }),
    ).toBeVisible();
  });
  test(`${device}: Month navigation and seven-step Monthly Reset`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/review?mode=month");
    await page.getByLabel("Date du bilan").fill("2026-10-15");
    await expect(page.getByLabel("Date du bilan")).toHaveValue("2026-10-01");
    await page.getByRole("button", { name: "Période suivante" }).click();
    await expect(page.getByLabel("Date du bilan")).toHaveValue("2026-11-01");
    await page.getByRole("button", { name: "Commencer le Reset" }).click();
    const panel = page.getByRole("region", { name: "Étape du Reset" });
    await expect(page.locator(".reset-hero")).toContainText("2026-10-01");
    await expect(
      panel.getByRole("heading", { name: "Last Month", exact: true }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      panel.getByRole("heading", { name: "Clean Up", exact: true }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.locator(".reset-hero")).toContainText("0 / 7");
    for (const title of [
      "Last Month",
      "Clean Up",
      "Projects",
      "Goals",
      "Focus Areas",
      "Month Calendar",
    ]) {
      await expect(
        panel.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await panel.getByRole("button", { name: "Done", exact: true }).click();
    }
    await panel
      .getByLabel("Priorité 1", { exact: true })
      .fill("Une intention pour novembre");
    await panel
      .getByRole("button", { name: "Enregistrer les priorités" })
      .click();
    await expect(
      panel.getByText("1 priorité(s) enregistrée(s)", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Done", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("heading", { name: "Monthly Reset", exact: true })
      .click();
    await page.screenshot({
      path: `artifacts/phase-10-monthly-reset-${device}.png`,
      fullPage: device === "desktop",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Votre bilan est conservé" }),
    ).toBeVisible();
    await expect(panel.getByLabel("Priorité 1", { exact: true })).toHaveValue(
      "Une intention pour novembre",
    );
  });
}
test("320px empty Insights remain honest and fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/review");
  await expect(
    page.getByText("Aucun créneau chronométré sur cette période."),
  ).toBeVisible();
  await expect(
    page.getByText("Aucune Habit pour cette période."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Aucun objectif de session renseigné pour le temps suivi ici.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/phase-10-empty-small.png",
    animations: "disabled",
  });
});
