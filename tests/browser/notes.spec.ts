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
async function create(page: Page, title: string, body: string) {
  await page.goto("/notes");
  await page
    .getByRole("button", { name: "Nouvelle note", exact: true })
    .click();
  await page.getByLabel("Titre de la note", { exact: true }).fill(title);
  await page.getByLabel("Contenu de la note", { exact: true }).fill(body);
  await page
    .getByRole("button", { name: "Enregistrer maintenant", exact: true })
    .click();
  await expect(
    page.locator(".note-editor").getByText("Enregistré", { exact: true }),
  ).toBeVisible();
}
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: note autosave, formatting, relations, selection to Task and source`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const body =
      "# Une idée\nTexte important\n- Une puce\n1. Première étape\n- [ ] Vérifier\n> Citation\n[Exemple](https://example.com)";
    await create(page, "Note " + device, body);
    await page.reload();
    await expect(page.getByLabel("Contenu de la note")).toHaveValue(body);
    await page.getByRole("button", { name: "Aperçu", exact: true }).click();
    await expect(
      page.locator(".note-preview").getByRole("heading", { name: "Une idée" }),
    ).toBeVisible();
    await expect(
      page.locator(".note-preview").getByRole("link", { name: "Exemple" }),
    ).toHaveAttribute("href", "https://example.com");
    await page.screenshot({
      path: `artifacts/phase-8-note-${device}.png`,
      animations: "disabled",
      fullPage: device === "desktop",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Écrire", exact: true }).click();
    const area = page.getByLabel("Contenu de la note");
    await area.focus();
    await area.press("ControlOrMeta+A");
    await page
      .getByRole("button", { name: "Transformer la sélection en Task" })
      .click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Titre de la Task").fill("Action depuis note " + device);
    await d.getByRole("button", { name: "Créer la Task", exact: true }).click();
    await expect(d).toHaveCount(0);
    await expect(area).toHaveValue(body);
    await page
      .locator(".note-relations")
      .getByRole("link", { name: "Action depuis note " + device })
      .click();
    await expect(
      page
        .locator(".note-relations")
        .getByRole("link", { name: "Note " + device }),
    ).toBeVisible();
  });
  test(`${device}: Shopping list, item edit, check, Undo and idempotent Task conversion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/notes?view=lists");
    await page
      .getByRole("button", { name: "Nouvelle liste", exact: true })
      .click();
    await page.getByLabel("Titre de la liste").fill("Courses " + device);
    await page.getByLabel("Type de liste").selectOption("shopping");
    await page
      .getByRole("button", { name: "Enregistrer la liste", exact: true })
      .click();
    await page.getByRole("button", { name: "Ajouter un élément" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Élément", { exact: true }).fill("Fleurs");
    await d.getByLabel("Détails").fill("Pour la maison");
    await d.getByLabel("Quantité").fill("2");
    await d.getByRole("button", { name: "Enregistrer l’élément" }).click();
    await expect(d).toHaveCount(0);
    await page.getByLabel("Fleurs", { exact: true }).click();
    await expect(page.getByLabel("Fleurs", { exact: true })).toBeChecked();
    await page
      .getByRole("button", { name: "Créer une Task", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "Task liée" })).toBeVisible();
    await page.getByRole("button", { name: "Retirer", exact: true }).click();
    await expect(page.getByLabel("Fleurs", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Annuler le retrait" }).click();
    await expect(page.getByLabel("Fleurs", { exact: true })).toBeChecked();
    await page.reload();
    await expect(page.getByLabel("Fleurs", { exact: true })).toBeChecked();
    await page.screenshot({
      path: `artifacts/phase-8-list-${device}.png`,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("two tabs never overwrite a newer note and conflict can be saved as a separate note", async ({
  page,
  context,
}) => {
  await create(page, "Partagée", "Original");
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.getByLabel("Contenu de la note")).toHaveValue("Original");
  await page.getByLabel("Contenu de la note").fill("Version premier onglet");
  await page.getByRole("button", { name: "Enregistrer maintenant" }).click();
  await expect(
    page.locator(".note-editor").getByText("Enregistré", { exact: true }),
  ).toBeVisible();
  await second.getByLabel("Contenu de la note").fill("Brouillon second onglet");
  await second.getByRole("button", { name: "Enregistrer maintenant" }).click();
  await expect(second.locator(".note-conflict")).toBeVisible();
  await second
    .getByRole("button", { name: "Conserver comme nouvelle note" })
    .click();
  await expect(second.getByLabel("Contenu de la note")).toHaveValue(
    "Brouillon second onglet",
  );
  await page.reload();
  await expect(page.getByLabel("Contenu de la note")).toHaveValue(
    "Version premier onglet",
  );
  await second.close();
});
test("offline draft survives refresh and saves on retry", async ({
  page,
  context,
}) => {
  await create(page, "Brouillon", "Serveur");
  const url = page.url();
  await context.setOffline(true);
  await page.getByLabel("Contenu de la note").fill("Texte hors connexion");
  await page.getByRole("button", { name: "Enregistrer maintenant" }).click();
  await expect(page.locator(".note-editor")).toContainText(
    "Brouillon conservé",
  );
  await context.setOffline(false);
  page.on("dialog", (d) => void d.accept());
  await page.goto(url);
  await expect(page.getByLabel("Contenu de la note")).toHaveValue(
    "Texte hors connexion",
  );
  await page.getByRole("button", { name: "Enregistrer maintenant" }).click();
  await expect(
    page.locator(".note-editor").getByText("Enregistré", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Contenu de la note")).toHaveValue(
    "Texte hors connexion",
  );
});
test("Quick Note and global search are real and persist", async ({ page }) => {
  await page.goto("/today");
  await page.getByRole("button", { name: "Ouvrir Quick Add" }).first().click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Note Capturer", exact: true }).click();
  await d.getByLabel("Titre de la note rapide").fill("Capture immédiate");
  await d.getByLabel("Note rapide", { exact: true }).fill("Mot unique opaline");
  await d.getByRole("button", { name: "Capturer la note" }).click();
  await expect(d.getByText("Note enregistrée.")).toBeVisible();
  await d.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("button", { name: "Search", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Rechercher une page ou une tâche", { exact: true })
    .fill("opaline");
  await page
    .getByRole("navigation", { name: "Notes et listes trouvées" })
    .getByRole("link", { name: "Capture immédiate" })
    .click();
  await expect(page.getByLabel("Contenu de la note")).toHaveValue(
    "Mot unique opaline",
  );
});
test("archive/restore and 320px note layout remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await create(page, "Petite note", "Un texte");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Archiver la note" }).click();
  await page
    .locator(".notes-index")
    .getByRole("link", { name: /Petite note/ })
    .click();
  await page.getByRole("button", { name: "Restaurer la note" }).click();
  await page
    .locator(".notes-index")
    .getByRole("link", { name: /Petite note/ })
    .click();
  await expect(page.getByLabel("Contenu de la note")).toHaveValue("Un texte");
});
test("preview checklist toggles and persists without changing other text", async ({
  page,
}) => {
  await create(page, "Checklist note", "Avant\n- [ ] Étape\nAprès");
  await page.getByRole("button", { name: "Aperçu", exact: true }).click();
  await page.getByLabel("Étape", { exact: true }).click();
  await expect(page.getByLabel("Étape", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Enregistrer maintenant" }).click();
  await expect(
    page.locator(".note-editor").getByText("Enregistré", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Contenu de la note")).toHaveValue(
    "Avant\n- [x] Étape\nAprès",
  );
});
