import { test, expect, type Page } from "@playwright/test";
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
async function capture(page: Page, title: string) {
  const input = page.getByLabel("Capturer une tâche", { exact: true });
  await input.fill(title);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
}
async function saveDetail(page: Page) {
  await page
    .getByRole("button", { name: "Enregistrer la tâche", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Modifier la tâche", exact: true }),
  ).toHaveCount(0);
}
async function smart(page: Page, name: string) {
  const nav = page
    .getByRole("navigation", { name: "Smart Lists", exact: true })
    .filter({ visible: true });
  await expect(nav).toBeVisible();
  const link = nav.getByRole("link", { name, exact: true });
  if (await link.count()) await link.click();
  else {
    await nav.getByRole("button", { name: /^Plus/ }).click();
    await page
      .getByRole("navigation", { name: "Autres Smart Lists" })
      .getByRole("link", { name, exact: true })
      .click();
  }
}
async function edit(page: Page) {
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
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
  test(`${device}: capture, clarify, Today priorities, completion and Undo`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const title = `Appeler vétérinaire ${device}`;
    await page.goto("/tasks");
    await capture(page, title);
    await page.reload();
    const row = page
      .locator(".task-row")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await expect(row).toContainText("À clarifier");
    await row.getByRole("button", { name: "To Do", exact: true }).click();
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
    await smart(page, "Sans Do Date");
    await expect(row).toBeVisible();
    await row.getByText("Actions rapides", { exact: true }).click();
    await row.getByLabel("Priorité", { exact: true }).selectOption("must");
    await expect(row.getByLabel("Priorité", { exact: true })).toBeEnabled();
    await row.getByLabel("Do Date", { exact: true }).fill(today());
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
    await smart(page, "Today");
    await expect(
      page
        .getByRole("region", { name: "Must", exact: true })
        .getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await fit(page);
    await page.screenshot({
      animations: "disabled",
      path: `artifacts/phase-4-ux-tasks-${device}.png`,
      fullPage: device === "desktop",
    });
    await row.getByRole("checkbox").click();
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Annuler la dernière action", exact: true })
      .click();
    await expect(row).toBeVisible();
    await row.getByRole("checkbox").click();
    await expect(row).toHaveCount(0);
    await smart(page, "Completed");
    await expect(row).toBeVisible();
    await page.reload();
    await expect(row.getByRole("checkbox")).toBeChecked();
    await row.getByRole("checkbox").click();
    await expect(row).toHaveCount(0);
    await smart(page, "Today");
    await expect(row).toBeVisible();
    await row.getByText("Actions rapides", { exact: true }).click();
    await row.getByRole("button", { name: "Someday", exact: true }).click();
    await smart(page, "Someday");
    await expect(row).toBeVisible();
    await row.getByText("Actions rapides", { exact: true }).click();
    await row.getByRole("button", { name: "Archiver", exact: true }).click();
    await smart(page, "Archives");
    await expect(row).toBeVisible();
    await row.getByText("Actions rapides", { exact: true }).click();
    await row.getByRole("button", { name: "Restaurer", exact: true }).click();
    await smart(page, "Someday");
    await expect(row).toBeVisible();
    expect(errors).toEqual([]);
  });
  test(`${device}: detail, Waiting, reminders, checklist, subtasks and search`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const title = `Dossier location ${device}`;
    await page.goto("/tasks");
    await capture(page, title);
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByLabel("Titre", { exact: true })).toHaveCount(0);
    await edit(page);
    await page
      .getByLabel("Description", { exact: true })
      .fill(`Réponse propriétaire unique ${device}`);
    await page.getByLabel("Statut", { exact: true }).selectOption("waiting");
    await page.getByLabel("Priorité", { exact: true }).selectOption("should");
    await page.getByLabel("Effort", { exact: true }).selectOption("deep");
    await page.getByLabel("Deadline", { exact: true }).fill("2020-01-01");
    await page.getByLabel("Do Date", { exact: true }).fill(today());
    await page
      .getByLabel("Durée estimée (minutes)", { exact: true })
      .fill("42");
    await page.getByLabel("Contexte", { exact: true }).fill("Computer");
    await page
      .getByLabel("Life Area", { exact: true })
      .selectOption({ label: "Administratif" });
    await page
      .getByLabel("Reminder · Europe/Paris", { exact: true })
      .fill("2030-11-05T15:00");
    await page
      .getByLabel("Waiting for", { exact: true })
      .fill("Réponse propriétaire");
    await page.getByLabel("Follow-up", { exact: true }).fill(today());
    await saveDetail(page);
    await page.reload();
    await edit(page);
    await expect(page.getByLabel("Statut", { exact: true })).toHaveValue(
      "waiting",
    );
    await expect(
      page.getByLabel("Reminder · Europe/Paris", { exact: true }),
    ).toHaveValue("2030-11-05T15:00");
    await expect(page.getByLabel("Waiting for", { exact: true })).toHaveValue(
      "Réponse propriétaire",
    );
    await page.keyboard.press("Escape");
    for (const label of ["Passeport", "Chargeur"]) {
      await page
        .getByLabel("Élément de checklist", { exact: true })
        .fill(label);
      await page
        .getByRole("button", { name: "Ajouter à la checklist", exact: true })
        .click();
      await expect(
        page.getByLabel("Élément de checklist", { exact: true }),
      ).toHaveValue("");
    }
    await page
      .getByRole("checkbox", { name: "Passeport", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Passeport", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Descendre Passeport", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Descendre Passeport", exact: true })
      .click();
    await expect(page.locator(".task-checklist li").first()).toContainText(
      "Chargeur",
    );
    const sub = page.getByLabel("Ajouter une sous-tâche", { exact: true });
    await sub.fill(`Pièce jointe ${device}`);
    await sub.press("Enter");
    await expect(sub).toHaveValue("");
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Passeport", exact: true }),
    ).toBeChecked();
    await expect(page.locator(".task-checklist li").first()).toContainText(
      "Chargeur",
    );
    await expect(
      page.getByRole("link", { name: `Pièce jointe ${device}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Modifier", exact: true }),
    ).toBeEnabled();
    await fit(page);
    await page.getByRole("heading", { level: 1 }).click();
    await page.screenshot({
      animations: "disabled",
      path: `artifacts/phase-4-ux-detail-${device}.png`,
      fullPage: device === "desktop",
    });
    await page
      .getByRole("link", { name: "← Retour aux tâches", exact: true })
      .click();
    await smart(page, "Waiting");
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await page.getByLabel("Rechercher les tâches", { exact: true }).fill(title);
    await page.getByRole("button", { name: /^Filters/ }).click();
    for (const label of [
      "Contexte",
      "Priorité",
      "Project",
      "Life Area",
      "Effort",
    ]) {
      await expect(
        page.getByRole("dialog").getByLabel(label, { exact: true }),
      ).toBeVisible();
    }
    await page.getByLabel("Contexte", { exact: true }).selectOption("Computer");
    await page
      .getByRole("dialog")
      .getByLabel("Priorité", { exact: true })
      .selectOption("should");
    await page
      .getByRole("dialog")
      .getByLabel("Effort", { exact: true })
      .selectOption("deep");
    await page
      .getByRole("button", { name: "Voir les résultats", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("42");
    await smart(page, "À relancer");
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: `artifacts/phase-4-waiting-${device}.png`,
      fullPage: device === "desktop",
    });
    if (device === "mobile") {
      await page
        .getByRole("button", { name: "Plus · À relancer", exact: true })
        .click();
      await page.screenshot({
        animations: "disabled",
        path: "artifacts/phase-4-ux-smart-lists-mobile.png",
        fullPage: false,
      });
      await page.keyboard.press("Escape");
    }
    await smart(page, "Today");
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
    await smart(page, "Overdue");
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    // The App Shell search includes description matches, also from mobile's menu.
    if (device === "mobile") {
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    }
    await page
      .getByRole("button", { name: "Search", exact: true })
      .filter({ visible: true })
      .click();
    await page
      .getByLabel("Rechercher une page ou une tâche", { exact: true })
      .fill(`unique ${device}`);
    await page
      .getByRole("navigation", { name: "Tâches trouvées" })
      .getByRole("link", { name: title, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: `Pièce jointe ${device}`, exact: true })
      .click();
    await expect(
      page.getByText("Un seul niveau de sous-tâches est disponible.", {
        exact: true,
      }),
    ).toBeVisible();
    await edit(page);
    await page.getByLabel("Statut", { exact: true }).selectOption("done");
    await saveDetail(page);
    await page
      .getByRole("link", { name: "Ouvrir la tâche parente", exact: true })
      .click();
    await edit(page);
    await expect(page.getByLabel("Statut", { exact: true })).toHaveValue(
      "waiting",
    );
  });
  test(`${device}: Project Tasks, task-based progress and Life Area integration`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    const project = `Tasks project ${device}`,
      title = `Action projet ${device}`;
    await page.goto("/projects");
    await page
      .getByRole("button", { name: "Nouveau Project", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Titre", { exact: true }).fill(project);
    await dialog
      .getByLabel("Life Area", { exact: true })
      .selectOption({ label: "Maison" });
    await dialog
      .getByLabel("Mode de progression", { exact: true })
      .selectOption("task_based");
    await dialog
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("link", { name: project, exact: true }).click();
    await capture(page, title);
    await expect(
      page.getByText("Progression · 0 %", { exact: true }),
    ).toBeVisible();
    const row = page
      .locator(".task-row")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await row.getByRole("checkbox").click();
    await expect(
      page.getByText("Progression · 100 %", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Progression · 100 %", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Capturer une tâche", { exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      animations: "disabled",
      path: `artifacts/phase-4-project-${device}.png`,
      fullPage: device === "desktop",
    });
    await row.getByRole("link", { name: title, exact: true }).click();
    await edit(page);
    await expect(page.getByLabel("Life Area", { exact: true })).toBeDisabled();
    await expect(
      page.getByLabel("Life Area", { exact: true }).locator("option:checked"),
    ).toHaveText("Maison");
    await page.goto("/life");
    const area = page.locator(".card").filter({
      has: page.getByRole("heading", { name: "Maison", exact: true }),
    });
    await area
      .getByRole("link", { name: "Voir les tâches", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await fit(page);
  });
  test(`${device}: Quick Add captures Tasks and keeps other entries unavailable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/today");
    await page
      .getByRole("button", { name: "Ouvrir Quick Add", exact: true })
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Quick Add", exact: true });
    await expect(dialog.locator("button:disabled")).toHaveCount(9);
    await dialog
      .getByRole("button", { name: "Task Capturer", exact: true })
      .click();
    await dialog
      .getByLabel("Capturer une tâche", { exact: true })
      .fill(`Quick Add ${device}`);
    await dialog
      .getByLabel("Capturer une tâche", { exact: true })
      .press("Enter");
    await expect(dialog.getByRole("status")).toHaveText(
      "Tâche ajoutée à Inbox.",
    );
    await page.keyboard.press("Escape");
    await page.goto("/tasks");
    await expect(
      page.getByRole("link", { name: `Quick Add ${device}`, exact: true }),
    ).toBeVisible();
  });
}
test("320px task capture and detail fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/tasks");
  await capture(page, "Small screen task");
  await fit(page);
  await page
    .getByRole("link", { name: "Small screen task", exact: true })
    .click();
  await fit(page);
  await edit(page);
  await fit(page);
  await page.getByLabel("Titre", { exact: true }).fill("   ");
  await page
    .getByRole("button", { name: "Enregistrer la tâche", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("requis");
});
