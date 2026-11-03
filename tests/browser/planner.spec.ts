import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  execFileSync("bun", ["scripts/today-browser-fixture.ts", "empty"], {
    env: process.env,
  });
  errors.set(page, []);
  page.on("pageerror", (e) => errors.get(page)!.push(e.message));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function open(page: Page, view = "day") {
  await page.goto("/planner?day=" + today() + "&view=" + view);
  await expect(
    page.getByRole("button", { name: "Créer un créneau", exact: true }),
  ).toBeEnabled();
}
async function create(
  page: Page,
  title: string,
  kind = "event",
  repeat = false,
) {
  await page
    .getByRole("button", { name: "Créer un créneau", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Type de créneau", { exact: true }).selectOption(kind);
  await modal.getByLabel("Titre du créneau", { exact: true }).fill(title);
  if (repeat)
    await modal.getByLabel("Répétition", { exact: true }).selectOption("daily");
  await modal
    .getByRole("button", { name: "Enregistrer le créneau", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
}
async function fit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: Planner real CRUD, recurrence scope, views, Today and persistence`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await create(page, "Rendez-vous réel");
    await create(page, "Travail réservé", "time_block", true);
    await expect(
      page.getByRole("button", {
        name: "Modifier Rendez-vous réel",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Modifier Travail réservé",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Modifier Travail réservé", exact: true })
      .click();
    await page
      .getByLabel("Appliquer à", { exact: true })
      .selectOption("occurrence");
    await page
      .getByLabel("Titre du créneau", { exact: true })
      .fill("Exception du jour");
    await page
      .getByRole("button", { name: "Enregistrer le créneau", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Vues du Planner" })
      .getByRole("button", { name: "Week", exact: true })
      .click();
    await fit(page);
    await page.screenshot({
      path: `artifacts/phase-6-week-${device}.png`,
      fullPage: device === "desktop",
      animations: "disabled",
    });
    await page
      .getByRole("navigation", { name: "Vues du Planner" })
      .getByRole("button", { name: "Month", exact: true })
      .click();
    await expect(page.locator(".planner-month")).toBeVisible();
    await fit(page);
    await page
      .getByRole("navigation", { name: "Vues du Planner" })
      .getByRole("button", { name: "Agenda", exact: true })
      .click();
    await expect(page.locator(".planner-agenda")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Travail réservé/ }).first(),
    ).toBeVisible();
    await page.goto("/today");
    const schedule = page.getByRole("region", {
      name: "Planning du jour",
      exact: true,
    });
    await expect(schedule).toContainText("Rendez-vous réel");
    await expect(schedule).toContainText("Exception du jour");
    await open(page);
    await page
      .getByRole("button", { name: "Modifier Rendez-vous réel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Retirer du Planner", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Modifier Rendez-vous réel",
        exact: true,
      }),
    ).toHaveCount(0);
  });
}
test("desktop: Task drag, move and resize keep the same Task and independent dates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tasks");
  const capture = page.getByLabel("Capturer une tâche", { exact: true });
  await capture.fill("Action à placer");
  await capture.press("Enter");
  await expect(capture).toHaveValue("");
  const row = page
    .locator(".task-row")
    .filter({
      has: page.getByRole("link", { name: "Action à placer", exact: true }),
    });
  await row.getByRole("button", { name: "To Do", exact: true }).click();
  await open(page);
  const task = page
    .locator(".planner-unscheduled")
    .getByRole("button", { name: "Action à placer", exact: true });
  const target = page.getByRole("button", {
    name: `Créer ${today()} 09:00`,
    exact: true,
  });
  await task.dragTo(target);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Enregistrer le créneau", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const block = page
    .locator(".planner-block")
    .filter({
      has: page.getByRole("button", {
        name: "Modifier Action à placer",
        exact: true,
      }),
    });
  await block.dragTo(
    page.getByRole("button", { name: `Créer ${today()} 11:00`, exact: true }),
  );
  await expect(block).toContainText("11:00");
  await block
    .getByRole("button", {
      name: "Redimensionner Action à placer",
      exact: true,
    })
    .dragTo(
      page.getByRole("button", { name: `Créer ${today()} 12:30`, exact: true }),
    );
  await expect(block).toContainText("12:30");
  await page.reload();
  await expect(block).toContainText("11:00–12:30");
  await block
    .getByRole("button", { name: "Modifier Action à placer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retirer du Planner", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(task).toBeVisible();
  await page.goto("/tasks?view=all");
  await expect(
    page.getByRole("link", { name: "Action à placer", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("link", { name: "Action à placer", exact: true })
    .click();
  await expect(page.locator(".task-property-list").first()).toContainText(
    "Do DateNon définie",
  );
});
test("320px Planner form and Month stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await create(page, "Petit écran");
  await fit(page);
  await page
    .getByRole("navigation", { name: "Vues du Planner" })
    .getByRole("button", { name: "Month", exact: true })
    .click();
  await fit(page);
  await page.locator(".planner-month").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/phase-6-month-small.png",
    animations: "disabled",
  });
});
