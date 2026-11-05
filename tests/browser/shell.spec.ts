import { test, expect } from "@playwright/test";
const routes = [
  "Today",
  "Planner",
  "Projects",
  "Tasks",
  "Notes",
  "Routines",
  "Life",
  "Review",
];
test("desktop navigation, active state, direct routes and profile from SQLite", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
  const nav = page.getByRole("navigation", {
    name: "Navigation principale",
    exact: true,
  });
  for (const label of routes) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  }
  await page
    .getByRole("button", { name: "Ouvrir le profil", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  for (const value of ["Jade", "Europe/Paris", "jade", "fr-FR", "Monday"])
    await expect(dialog.getByText(value, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Ouvrir le profil", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("desktop search navigates only to real shell routes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/today");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Rechercher une page ou une tâche", { exact: true }).fill("Notes");
  await page
    .getByRole("navigation", { name: "Résultats de recherche" })
    .getByRole("link", { name: "Notes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const [name, width, height] of [
  ["large", 1920, 1080],
  ["laptop", 1280, 800],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["iPhone", 390, 844],
  ["small mobile", 320, 568],
] as const) {
  test(`${name}: layout, Quick Add, focus trap and viewport fit`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/today");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const trigger = page
      .getByRole("button", { name: "Ouvrir Quick Add", exact: true })
      .filter({ visible: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Quick Add", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Task et Timer disponibles · autres actions à venir"),
    ).toBeVisible();
    await expect(dialog.locator("button:disabled")).toHaveCount(8);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    if (width <= 900) {
      const nav = page.getByRole("navigation", {
        name: "Navigation mobile",
        exact: true,
      });
      await nav.getByRole("link", { name: "Planner", exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Planner",
      );
      await expect(
        nav.getByRole("link", { name: "Planner", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await page
        .getByRole("navigation", { name: "Toutes les pages" })
        .getByRole("link", { name: "Review", exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Review",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const target = await trigger.boundingBox();
      expect(target!.width).toBeGreaterThanOrEqual(44);
      expect(target!.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("essential form controls and accessible tabs", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("tab", { name: "Composants", exact: true }).click();
  await page
    .getByLabel("Champ de démonstration", { exact: true })
    .fill("Test local");
  await expect(
    page.getByLabel("Champ de démonstration", { exact: true }),
  ).toHaveValue("Test local");
  await expect(
    page.getByLabel("Champ en erreur", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Champ désactivé", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Exemple de case à cocher", { exact: true }).check();
  await expect(
    page.getByLabel("Exemple de case à cocher", { exact: true }),
  ).toBeChecked();
  await page.getByRole("switch", { name: "Exemple d’interrupteur" }).check();
  await expect(
    page.getByRole("switch", { name: "Exemple d’interrupteur" }),
  ).toBeChecked();
  await page.getByLabel("Densité de démonstration").selectOption("Compacte");
  await expect(
    page.getByRole("button", { name: "Chargement", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Composants", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Interactions", exact: true }),
  ).toBeFocused();
});

test("dialog, sheet, dropdown and tooltip keyboard behavior", async ({
  page,
}) => {
  await page.goto("/design-system");
  await page.getByRole("tab", { name: "Interactions", exact: true }).click();
  for (const [button, title] of [
    ["Ouvrir le dialogue", "Un dialogue Jade"],
    ["Ouvrir la sheet", "Une sheet Jade"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeFocused();
  }
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Compacte", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Compacte");
  await page.getByRole("tab", { name: "Composants", exact: true }).click();
  await page.getByRole("button", { name: "Information", exact: true }).focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "accessible au clavier",
  );
});

test("mobile profile and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/life");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Votre espace",
    exact: true,
  });
  for (const value of ["Jade", "Europe/Paris", "jade", "fr-FR", "Monday"]) {
    await expect(dialog.getByText(value, { exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ouvrir le menu" }),
  ).toBeFocused();
  expect(
    await page
      .locator(".mobile-add")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});
