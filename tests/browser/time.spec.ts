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
async function focus(page: Page) {
  await page.goto("/focus");
  await expect(
    page.getByRole("button", { name: "Quick Timer", exact: true }),
  ).toBeEnabled();
}
async function start(page: Page, title: string) {
  await page.getByRole("button", { name: "Quick Timer", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Activité (facultatif pour une source liée)").fill(title);
  await d.getByLabel("Objectif de session").selectOption("25");
  await d.getByRole("button", { name: "Start", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(page.locator(".focus-stage h2")).toHaveText(title);
}
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: persistent Timer, Pause & Start, resume, explicit finish and Today`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await focus(page);
    await start(page, "Première session");
    await page.reload();
    await expect(page.locator(".focus-stage h2")).toHaveText(
      "Première session",
    );
    await page.goto("/today");
    const strip = page.locator(
      device === "mobile" ? ".mobile-timer" : ".timer-slot",
    );
    await expect(strip).toContainText("Première session");
    await page.getByRole("button", { name: "Ouvrir Quick Add" }).last().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Start Timer Démarrer", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d
      .getByLabel("Activité (facultatif pour une source liée)")
      .fill("Seconde session");
    await d.getByRole("button", { name: "Pause & Start", exact: true }).click();
    await expect(d).toHaveCount(0);
    await page.goto("/focus");
    await expect(page.locator(".focus-stage h2")).toHaveText("Seconde session");
    const paused = page.locator(".time-list").first();
    await expect(paused).toContainText("Première session");
    await paused.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.locator(".focus-stage h2")).toHaveText(
      "Première session",
    );
    await expect(paused).toContainText("Seconde session");
    await page
      .locator(".focus-stage")
      .getByRole("button", { name: "Pause", exact: true })
      .click();
    await expect(
      paused.getByRole("button", { name: "Resume", exact: true }),
    ).toHaveCount(2);
    await page.reload();
    await expect(
      paused.getByRole("button", { name: "Resume", exact: true }),
    ).toHaveCount(2);
    await paused
      .getByRole("button", { name: "Resume", exact: true })
      .first()
      .click();
    await expect(page.locator(".focus-clock")).toBeVisible();
    await page.screenshot({
      path: `artifacts/phase-7-focus-${device}.png`,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".focus-stage")
      .getByRole("button", { name: "Finish", exact: true })
      .click();
    await paused.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(
      paused.getByRole("button", { name: "Resume", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".time-list")
        .last()
        .getByRole("button", { name: "Corriger", exact: true }),
    ).toHaveCount(2);
  });
  test(`${device}: manual time, pause correction and refresh`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await focus(page);
    await page.getByRole("button", { name: "Ajouter du temps manuel" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Activité", { exact: true }).fill("Travail manuel");
    await d.getByLabel("Début", { exact: true }).fill("2026-01-10T09:00");
    await d.getByLabel("Fin", { exact: true }).fill("2026-01-10T11:00");
    await d.getByRole("button", { name: "Ajouter une pause" }).click();
    await d.getByLabel("Début de pause").fill("2026-01-10T09:30");
    await d.getByLabel("Fin de pause").fill("2026-01-10T10:00");
    await d.getByRole("button", { name: "Enregistrer le temps" }).click();
    await expect(d).toHaveCount(0);
    await expect(page.locator(".time-list").last()).toContainText("01:30:00");
    await page.reload();
    await expect(page.locator(".time-list").last()).toContainText("01:30:00");
    await page.getByRole("button", { name: "Corriger", exact: true }).click();
    await d.getByRole("button", { name: "Retirer la pause" }).click();
    await d.getByRole("button", { name: "Enregistrer le temps" }).click();
    await expect(d).toHaveCount(0);
    await expect(page.locator(".time-list").last()).toContainText("02:00:00");
  });
}
test("Task source and Focus checklist persist without completing the Task", async ({
  page,
}) => {
  await page.goto("/tasks");
  await page.getByLabel("Capturer une tâche").fill("Action chronométrée");
  await page.getByLabel("Capturer une tâche").press("Enter");
  await page
    .getByRole("link", { name: "Action chronométrée", exact: true })
    .click();
  await page.getByLabel("Élément de checklist").fill("Étape");
  await page.getByRole("button", { name: "Ajouter à la checklist" }).click();
  await page
    .getByRole("button", { name: "Démarrer le timer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/focus");
  await expect(page.locator(".focus-stage h2")).toHaveText(
    "Action chronométrée",
  );
  await page.getByLabel("Étape", { exact: true }).click();
  await expect(page.getByLabel("Étape", { exact: true })).toBeChecked();
  await page
    .locator(".focus-stage")
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await page.goto("/tasks");
  await expect(
    page.getByRole("link", { name: "Action chronométrée", exact: true }),
  ).toBeVisible();
});
test("small mobile Focus fits viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await focus(page);
  await start(page, "Focus petit écran");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/phase-7-focus-small.png",
    animations: "disabled",
  });
});
test("Planner Time Block launches a session with immutable planned duration", async ({
  page,
}) => {
  await page.goto("/planner?day=2026-11-05&view=day");
  await page
    .getByRole("button", { name: "Créer un créneau", exact: true })
    .click();
  let d = page.getByRole("dialog").last();
  await d.getByLabel("Type de créneau").selectOption("time_block");
  await d.getByLabel("Titre du créneau").fill("Créneau Focus");
  await d
    .getByRole("button", { name: "Enregistrer le créneau", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Modifier Créneau Focus", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Démarrer le timer", exact: true })
    .click();
  d = page.getByRole("dialog").last();
  await d.getByRole("button", { name: "Start", exact: true }).click();
  await page.goto("/focus");
  await expect(page.locator(".focus-stage")).toContainText("min prévues");
  await expect(page.locator(".focus-stage h2")).toHaveText("Créneau Focus");
  await page
    .locator(".focus-stage")
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await expect(page.locator(".time-list").last()).toContainText("min prévues");
});
test("Life Area source and Cancel / Stop & Start preserve explicit intent", async ({
  page,
}) => {
  await page.goto("/life");
  await page
    .getByRole("button", { name: "Démarrer le timer", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir Quick Add" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start Timer Démarrer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.goto("/focus");
  await expect(page.locator(".focus-clock")).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir Quick Add" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start Timer Démarrer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Activité (facultatif pour une source liée)")
    .fill("Remplacement explicite");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop & Start", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".focus-stage h2")).toHaveText(
    "Remplacement explicite",
  );
  await expect(
    page.locator(".time-list").first().getByRole("button", { name: "Resume" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".time-list").last().getByRole("button", { name: "Corriger" }),
  ).toHaveCount(1);
});

test('correcting only the title of a short tracked session preserves its timestamps',async({page})=>{await focus(page);await start(page,'Court');await page.locator('.focus-stage').getByRole('button',{name:'Finish',exact:true}).click();await page.getByRole('button',{name:'Corriger',exact:true}).click();const d=page.getByRole('dialog');await d.getByLabel('Activité',{exact:true}).fill('Court corrigé');await d.getByRole('button',{name:'Enregistrer le temps'}).click();await expect(d).toHaveCount(0);await expect(page.locator('.time-list').last()).toContainText('Court corrigé');});
