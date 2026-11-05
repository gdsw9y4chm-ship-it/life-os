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
async function habit(page: Page, title: string, kind = "count") {
  await page.goto("/life/habits");
  await page
    .getByRole("button", { name: "Nouvelle Habit", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Titre", { exact: true }).fill(title);
  await d.getByLabel("Fréquence", { exact: true }).selectOption("weekly");
  await d.getByLabel("Objectif", { exact: true }).selectOption(kind);
  if (kind === "duration")
    await d.getByLabel("Minutes par jour réussi").fill("20");
  await d.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(d).not.toBeVisible();
  return page.getByRole("article", { name: title, exact: true });
}
async function routine(page: Page) {
  await page.goto("/routines");
  await page
    .getByRole("button", { name: "Nouvelle Routine", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Titre", { exact: true }).fill("Morning ritual");
  await d.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Étapes de la routine" }),
  ).toBeVisible();
}
async function step(page: Page, title: string, kind = "simple") {
  await page
    .getByRole("button", { name: "Ajouter une étape", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Titre de l’étape").fill(title);
  await d.getByLabel("Type d’étape").selectOption(kind);
  if (kind === "checklist")
    await d
      .getByLabel("Checklist · une ligne par élément")
      .fill("Ouvrir les rideaux\nBoire un verre");
  await d
    .getByRole("button", { name: "Enregistrer l’étape", exact: true })
    .click();
  await expect(d).not.toBeVisible();
}
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: Habit quotas, history, pause, Timer and Today`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const card = await habit(page, "Lire vingt minutes", "duration");
    await expect(card.getByText("0 / 3", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Done", exact: true }).click();
    await expect(card.getByText("1 / 3", { exact: true })).toBeVisible();
    await page.reload();
    await expect(card.getByText("1 / 3", { exact: true })).toBeVisible();
    await card
      .getByText("Détails de Lire vingt minutes", { exact: true })
      .click();
    await card
      .getByRole("button", { name: "Mettre en pause", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Reprendre la Habit" }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Reprendre la Habit" }).click();
    await page.getByRole("heading", { name: "Habits", exact: true }).click();
    if (device === "mobile")
      await card.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `artifacts/phase-9-habits-${device}.png`,
      fullPage: device === "desktop",
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/today");
    await expect(
      page.getByRole("link", { name: "Lire vingt minutes", exact: true }),
    ).toBeVisible();
    await page.goto("/life/habits");
    await card
      .getByText("Détails de Lire vingt minutes", { exact: true })
      .click();
    await card
      .getByRole("button", { name: "Timer Habit", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Start", exact: true }).click();
    await expect(d).not.toBeVisible();
    await page.goto("/focus");
    await expect(
      page.getByText("Lire vingt minutes", { exact: true }).first(),
    ).toBeVisible();
  });
  test(`${device}: guided Routine checklist, navigation, Skip and persistence`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await routine(page);
    await step(page, "Préparer la journée", "checklist");
    await step(page, "Lire calmement");
    await page
      .getByRole("button", { name: "Commencer la routine", exact: true })
      .click();
    const run = page.getByRole("region", { name: "Passage guidé" });
    await expect(
      run.getByRole("heading", { name: "Préparer la journée" }),
    ).toBeVisible();
    await run.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      run.getByRole("heading", { name: "Lire calmement" }),
    ).toBeVisible();
    await run.getByRole("button", { name: "Previous", exact: true }).click();
    await run.getByLabel("Ouvrir les rideaux").check();
    await expect(run.getByLabel("Ouvrir les rideaux")).toBeChecked();
    await run.getByLabel("Boire un verre").check();
    await page.reload();
    await expect(run.getByLabel("Boire un verre")).toBeChecked();
    await expect(
      run.getByRole("button", { name: "Done", exact: true }),
    ).toBeEnabled();
    await page.getByRole("heading", { name: "Routines", exact: true }).click();
    if (device === "mobile")
      await run.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `artifacts/phase-9-routine-${device}.png`,
      fullPage: device === "desktop",
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await run.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      run.getByRole("heading", { name: "Lire calmement" }),
    ).toBeVisible();
    await run.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(run.getByText(/Passage terminé/)).toBeVisible();
    await page.reload();
    await expect(run.getByText(/Passage terminé/)).toBeVisible();
  });
  test(`${device}: Tracker counter, note, history and archive restore`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/life/trackers");
    await page
      .getByRole("button", { name: "Nouveau Tracker", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Titre", { exact: true }).fill("Verres d’eau");
    await d.getByLabel("Type", { exact: true }).selectOption("counter");
    await d.getByLabel("Unité", { exact: true }).fill("verres");
    await d.getByLabel("Cible facultative").fill("8");
    await d.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(d).not.toBeVisible();
    const card = page.getByRole("article", { name: "Verres d’eau" });
    await card.getByText("Détails de Verres d’eau", { exact: true }).click();
    await card.getByLabel("Note du jour").fill("Pendant la matinée");
    await card.getByLabel("Valeur du jour verres").fill("2");
    await card.getByRole("button", { name: "Enregistrer la valeur" }).click();
    await expect(card.locator(".practice-total")).toContainText("2");
    await expect(card.getByLabel("Valeur du jour verres")).toHaveValue("2");
    await card.getByRole("button", { name: "+1", exact: true }).click();
    await expect(card.getByLabel("Valeur du jour verres")).toHaveValue("3");
    await page.reload();
    await card.getByText("Détails de Verres d’eau", { exact: true }).click();
    await expect(card.getByLabel("Note du jour")).toHaveValue(
      "Pendant la matinée",
    );
    await expect(
      card.getByRole("button", { name: "Enregistrer la valeur", exact: true }),
    ).toBeEnabled();
    await page.getByRole("heading", { name: "Trackers", exact: true }).click();
    if (device === "mobile")
      await card.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `artifacts/phase-9-trackers-${device}.png`,
      fullPage: device === "desktop",
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card.getByRole("button", { name: "Archiver", exact: true }).click();
    await expect(card).not.toBeVisible();
    await page.getByRole("link", { name: "Archives", exact: true }).click();
    await card.getByText("Détails de Verres d’eau", { exact: true }).click();
    await card.getByRole("button", { name: "Restaurer", exact: true }).click();
    await page.getByRole("link", { name: "Actifs", exact: true }).click();
    await card.getByText("Détails de Verres d’eau", { exact: true }).click();
    await expect(card.getByLabel("Valeur du jour verres")).toHaveValue("3");
  });
}
test("small mobile empty states and Life access remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/life");
  await page
    .getByRole("navigation", { name: "Pratiques de Life" })
    .getByRole("link", { name: "Habits", exact: true })
    .click();
  await expect(page.getByText(/Aucune Habit pour cette date/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Pratiques de Life" })
    .getByRole("link", { name: "Trackers", exact: true })
    .click();
  await expect(page.getByText(/Aucun Tracker/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/phase-9-small.png",
    animations: "disabled",
  });
});
