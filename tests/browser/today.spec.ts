import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

function fixture(mode: "empty" | "populated" | "sparse") {
  execFileSync("bun", ["scripts/today-browser-fixture.ts", mode], {
    env: process.env,
  });
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.get(page)!.push(message.text());
  });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function openToday(page: Page) {
  await page.goto("/today");
  await expect(
    page
      .getByRole("button", { name: "Ouvrir Quick Add", exact: true })
      .filter({ visible: true }),
  ).toBeEnabled();
}
async function fit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function screenshot(page: Page, name: string, fullPage: boolean) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `artifacts/phase-5-${name}.png`,
    fullPage,
    animations: "disabled",
  });
}
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
  ["small", 320, 568],
] as const) {
  test(`${device}: genuine empty Today and Quick Add stays in context`, async ({
    page,
  }) => {
    fixture("empty");
    await page.setViewportSize({ width, height });
    await openToday(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
    await expect(page.getByText("Bonjour Jade", { exact: true })).toBeVisible();
    const date = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    await expect(page.locator(".today-date")).toHaveText(date);
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 0", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Votre journée peut respirer.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".task-priority-group")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "À relancer", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".today-overdue, .today-inbox")).toHaveCount(0);
    await expect(
      page.getByText("Aucun projet actif pour le moment.", { exact: true }),
    ).toBeVisible();
    await fit(page);
    await screenshot(page, `empty-${device}`, device === "desktop");
    await page
      .getByRole("button", { name: "Ouvrir Quick Add", exact: true })
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Task Capturer", exact: true })
      .click();
    await dialog
      .getByLabel("Capturer une tâche", { exact: true })
      .fill("Capture depuis Today");
    await dialog
      .getByLabel("Capturer une tâche", { exact: true })
      .press("Enter");
    await expect(dialog.getByRole("status")).toHaveText(
      "Tâche ajoutée à Inbox.",
    );
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.locator(".today-inbox")).toContainText(
      "1 élément à clarifier",
    );
    await page.reload();
    await expect(page.locator(".today-inbox")).toContainText(
      "1 élément à clarifier",
    );
    await page.locator(".today-inbox").click();
    await expect(
      page.getByRole("link", { name: "Capture depuis Today", exact: true }),
    ).toBeVisible();
  });
  test(`${device}: real groups, attention, projects, completion, Undo, actions and links`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    fixture("populated");
    await page.setViewportSize({ width, height });
    await openToday(page);
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 4", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Must : 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Relances dues : 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Projets liés au jour : 1", exact: true }),
    ).toBeVisible();
    const focus = page.getByRole("region", {
      name: "Focus du jour",
      exact: true,
    });
    await expect(focus.locator(".task-priority-group > h3")).toHaveText([
      "Must 1",
      "Should 1",
      "Could 1",
      "Sans priorité 1",
    ]);
    await expect(
      focus.getByText("Dossier location", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Dossier location/ }),
    ).toContainText("Relance aujourd’hui");
    await expect(page.getByText("Attente future", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator(".today-overdue")).toContainText(
      "1 tâche en retard",
    );
    await expect(page.locator(".today-inbox")).toContainText(
      "2 éléments à clarifier",
    );
    const project = page.locator(".today-project").filter({
      has: page.getByRole("heading", {
        name: "Life OS · Today",
        exact: true,
      }),
    });
    await expect(page.locator(".today-project").first()).toContainText(
      "Life OS · Today",
    );
    await expect(project.getByRole("progressbar")).toHaveAttribute(
      "value",
      "50",
    );
    await expect(
      page
        .locator(".today-project")
        .filter({ hasText: "Une nouvelle idée" })
        .getByRole("progressbar"),
    ).toHaveCount(0);
    await fit(page);
    await screenshot(page, `today-${device}`, device === "desktop");
    await page
      .getByRole("checkbox", { name: "Terminer Finaliser Today", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 3", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Must : 0", exact: true }),
    ).toBeVisible();
    await expect(project.getByRole("progressbar")).toHaveAttribute(
      "value",
      "100",
    );
    await expect(
      focus.getByRole("region", { name: "Must", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Annuler la dernière action", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: "Terminer Finaliser Today",
        exact: true,
      }),
    ).toBeVisible();
    await expect(project.getByRole("progressbar")).toHaveAttribute(
      "value",
      "50",
    );
    const row = focus.locator(".task-row").filter({
      has: page.getByRole("link", { name: "Finaliser Today", exact: true }),
    });
    await row.getByText("Actions rapides", { exact: true }).click();
    await expect(row.getByLabel("Project", { exact: true })).toBeEnabled();
    await expect(
      row.getByLabel("Project", { exact: true }).locator("option:checked"),
    ).toHaveText("Life OS · Today");
    await row.getByLabel("Priorité", { exact: true }).selectOption("should");
    await expect(
      page.getByRole("link", { name: "Must : 0", exact: true }),
    ).toBeVisible();
    await expect(
      focus.getByRole("region", { name: "Should", exact: true }),
    ).toContainText("Finaliser Today");
    await page.reload();
    await expect(
      focus.getByRole("region", { name: "Should", exact: true }),
    ).toContainText("Finaliser Today");
    await page
      .getByRole("checkbox", { name: "Terminer Finaliser Today", exact: true })
      .click();
    await expect(project.getByRole("progressbar")).toHaveAttribute(
      "value",
      "100",
    );
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 3", exact: true }),
    ).toBeVisible();
    await expect(project.getByRole("progressbar")).toHaveAttribute(
      "value",
      "100",
    );
    await page.getByRole("link", { name: /Dossier location/ }).click();
    await expect(
      page.getByRole("heading", { name: "Dossier location", exact: true }),
    ).toBeVisible();
    await openToday(page);
    await page.locator(".today-overdue").click();
    await expect(
      page.getByRole("link", { name: "Facture à vérifier", exact: true }),
    ).toBeVisible();
    await openToday(page);
    await page.locator(".today-inbox").click();
    await expect(
      page.getByRole("link", { name: "Idée à classer", exact: true }),
    ).toBeVisible();
    await openToday(page);
    await page
      .getByRole("link", { name: "Toutes les tâches", exact: true })
      .click();
    await expect(page).toHaveURL(/view=all/);
    await openToday(page);
    await page.getByRole("link", { name: "Voir tous", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await openToday(page);
    await project.click();
    await expect(
      page.getByRole("heading", { name: "Life OS · Today", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Progression · 100 %", { exact: true }),
    ).toBeVisible();
  });
}

for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: quiet day and last task completion retain Undo`, async ({
    page,
  }) => {
    fixture("sparse");
    await page.setViewportSize({ width, height });
    await openToday(page);
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 1", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".task-priority-group")).toHaveCount(1);
    await screenshot(page, `quiet-${device}`, device === "desktop");
    await page
      .getByRole("checkbox", {
        name: "Terminer Une seule chose à faire",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Votre journée peut respirer.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 0", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Annuler la dernière action", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: "Terminer Une seule chose à faire",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Tâches du jour : 1", exact: true }),
    ).toBeVisible();
    await fit(page);
  });
}
