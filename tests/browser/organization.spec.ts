import { test, expect, type Page } from "@playwright/test";
async function save(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function fillTitle(page: Page, title: string) {
  await page
    .getByRole("dialog")
    .getByLabel("Titre", { exact: true })
    .fill(title);
}
async function fit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) {
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
  }
}
test("initial seed and genuine empty states", async ({ page }) => {
  await page.goto("/life");
  for (const name of [
    "Personnel",
    "Couple",
    "Maison",
    "Animaux",
    "Beauté",
    "Santé & Sport",
    "Travail & IA",
    "Modèle / Créatif",
    "Administratif",
    "Spiritualité",
    "Social & Loisirs",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await page.getByRole("tab", { name: "Goals", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Quel résultat souhaitez-vous atteindre ?",
    }),
  ).toBeVisible();
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "De l’intention au projet" }),
  ).toBeVisible();
  await expect(page.locator("progress")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/phase-3-projects-empty.png",
    fullPage: true,
  });
});
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: create, edit, link, reorder and persist organization`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const area = `Voyages ${device}`,
      goal = `Découvrir ${device}`,
      project = `Escapade ${device}`;
    await page.goto("/life");
    await expect(
      page.getByRole("button", { name: "Nouvelle Life Area", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/phase-3-life-${device}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Nouvelle Life Area", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Nom", { exact: true })
      .fill(area);
    await fit(page);
    await save(page);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: area, exact: true }),
    ).toBeVisible();
    const areaCard = page
      .locator(".card")
      .filter({ has: page.getByRole("heading", { name: area, exact: true }) });
    await areaCard
      .getByRole("button", { name: "Modifier", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Description")
      .fill("Un domaine personnel enregistré.");
    await save(page);
    await expect(areaCard).toContainText("Un domaine personnel enregistré.");
    await page.getByRole("tab", { name: "Goals", exact: true }).click();
    await page
      .getByRole("button", { name: "Nouveau Goal", exact: true })
      .click();
    await fillTitle(page, goal);
    await page
      .getByRole("dialog")
      .getByLabel("Type", { exact: true })
      .selectOption("numeric");
    await page.getByRole("dialog").getByLabel("Valeur cible").fill("3");
    await page.getByRole("dialog").getByLabel("Unité").fill("voyages");
    await fit(page);
    await save(page);
    await expect(
      page.getByRole("heading", { name: goal, exact: true }),
    ).toBeVisible();
    const goalCard = page
      .locator(".card")
      .filter({ has: page.getByRole("heading", { name: goal, exact: true }) });
    await goalCard
      .getByRole("button", { name: "Modifier", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Statut").selectOption("paused");
    await save(page);
    await expect(goalCard).toContainText("Paused");
    await page.goto("/projects");
    await page
      .getByRole("button", { name: "Nouveau Project", exact: true })
      .click();
    await fillTitle(page, project);
    await page
      .getByRole("dialog")
      .getByLabel("Life Area", { exact: true })
      .selectOption({ label: area });
    await page
      .getByRole("dialog")
      .getByLabel("Goal", { exact: true })
      .selectOption({ label: goal });
    await page
      .getByRole("dialog")
      .getByLabel("Mode de progression")
      .selectOption("milestones");
    await fit(page);
    await page.screenshot({
      path: `artifacts/phase-3-project-form-${device}.png`,
    });
    await save(page);
    await page.getByRole("link", { name: project, exact: true }).click();
    await expect(page.locator(".project-overview")).toContainText(area);
    await expect(page.locator(".project-overview")).toContainText(goal);
    await expect(page.locator("progress")).toHaveCount(0);
    for (const title of ["Première étape", "Seconde étape"]) {
      await page
        .getByRole("button", { name: "Nouveau Milestone", exact: true })
        .click();
      await fillTitle(page, title);
      await fit(page);
      await save(page);
    }
    const first = page
      .locator(".milestone-list li")
      .filter({ hasText: "Première étape" });
    await first.getByRole("button", { name: "Modifier", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Statut")
      .selectOption("completed");
    await save(page);
    await expect(
      page.getByText("Progression · 50 %", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Descendre Première étape", exact: true })
      .click();
    await expect(page.locator(".milestone-list li").first()).toContainText(
      "Seconde étape",
    );
    await page.reload();
    await expect(page.locator(".milestone-list li").first()).toContainText(
      "Seconde étape",
    );
    await expect(
      page.getByText("Progression · 50 %", { exact: true }),
    ).toBeVisible();
    await fit(page);
    await page.getByRole("heading", { level: 1 }).click();
    await page.screenshot({
      path: `artifacts/phase-3-detail-${device}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Modifier le Project", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Statut").selectOption("waiting");
    await page
      .getByRole("dialog")
      .getByLabel("Description")
      .fill("Les données restent après refresh.");
    await save(page);
    await page.reload();
    await expect(page.locator(".project-overview")).toContainText("Waiting");
    await expect(page.locator(".project-overview")).toContainText(
      "Les données restent après refresh.",
    );
    await page.getByRole("link", { name: "← Tous les Projects" }).click();
    await expect(
      page
        .getByRole("region", { name: "Paused / Waiting" })
        .getByRole("link", { name: project }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/phase-3-projects-${device}.png`,
      fullPage: true,
    });
    await page.goto("/life");
    await areaCard
      .getByRole("button", { name: "Modifier", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Visibilité")
      .selectOption("true");
    await save(page);
    await expect(
      page.getByRole("heading", { name: area, exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Archives", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: area, exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Archives", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: area, exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
  test(`${device}: manual progress validation, modes and archived history`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/projects");
    await page
      .getByRole("button", { name: "Nouveau Project", exact: true })
      .click();
    await fillTitle(page, `Progress ${device}`);
    await page
      .getByRole("dialog")
      .getByLabel("Mode de progression")
      .selectOption("manual");
    const progress = page.getByRole("dialog").getByLabel("Progression (%)");
    await progress.fill("101");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enregistrer" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await progress.evaluate(
        (input: HTMLInputElement) => input.validity.rangeOverflow,
      ),
    ).toBe(true);
    await progress.fill("0");
    await save(page);
    await page
      .getByRole("link", { name: `Progress ${device}`, exact: true })
      .click();
    await expect(
      page.getByText("Progression · 0 %", { exact: true }),
    ).toBeVisible();
    for (const mode of ["task_based", "none"]) {
      await page.getByRole("button", { name: "Modifier le Project" }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Mode de progression")
        .selectOption(mode);
      await save(page);
      await expect(page.locator("progress")).toHaveCount(0);
      await expect(
        page.getByText(
          mode === "none"
            ? "Aucune progression suivie."
            : "Disponible lorsque les tâches seront intégrées.",
          { exact: true },
        ),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Modifier le Project" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Statut")
      .selectOption("archived");
    await save(page);
    await page.reload();
    await expect(page.locator(".project-overview")).toContainText("Archived");
  });
}
test("320px forms, keyboard dismissal and missing project error", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/life");
  await page.getByRole("button", { name: "Nouvelle Life Area" }).click();
  await fit(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nouvelle Life Area" }),
  ).toBeFocused();
  await page.goto("/projects/missing");
  await expect(page.getByRole("alert")).toContainText("indisponibles");
});

test("server validation preserves the form and does not create invalid data", async ({
  page,
}) => {
  await page.goto("/life");
  await page
    .getByRole("button", { name: "Nouvelle Life Area", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Nom", { exact: true }).fill("   ");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("requis");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByLabel("Nom", { exact: true })
    .fill("Correction après erreur");
  await save(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Correction après erreur", exact: true }),
  ).toBeVisible();
});
