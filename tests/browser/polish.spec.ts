import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${device}: reading mode and compact dashboards expose full detail on demand`, async ({
    page,
  }) => {
    execFileSync("bun", ["scripts/today-browser-fixture.ts", "empty"], {
      env: process.env,
    });
    await page.setViewportSize({ width, height });
    await page.goto("/notes");
    await page
      .getByRole("button", { name: "Nouvelle note", exact: true })
      .click();
    await page
      .getByLabel("Titre de la note", { exact: true })
      .fill("Un moment pour soi");
    await page
      .getByLabel("Contenu de la note", { exact: true })
      .fill(
        "# Mes essentiels\nUne page calme pour retrouver mes idées.\n- Lire\n- Marcher",
      );
    await page
      .getByRole("button", { name: "Terminer la modification" })
      .click();
    await expect(page.locator(".note-reading")).toBeVisible();
    await expect(page.getByLabel("Type de note")).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Modifier", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/polish-notes-${device}.png`,
      fullPage: device === "desktop",
    });
    await page.goto("/life/habits");
    for (let i = 0; i < 8; i++) {
      await page
        .getByRole("button", { name: "Nouvelle Habit", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d
        .getByLabel("Titre", { exact: true })
        .fill(
          [
            "Lire",
            "Bouger",
            "Respirer",
            "S’étirer",
            "Écrire",
            "Sortir",
            "Ranger",
            "Apprendre",
          ][i],
        );
      await d.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(d).not.toBeVisible();
    }
    await expect(page.locator(".habit-dashboard article")).toHaveCount(8);
    await expect(
      page
        .getByRole("button", { name: "Mettre en pause", exact: true })
        .first(),
    ).not.toBeVisible();
    await page.screenshot({
      path: `artifacts/polish-habits-${device}.png`,
      fullPage: device === "desktop",
    });
    await page.getByText("Détails de Lire", { exact: true }).click();
    await expect(
      page
        .getByRole("article", { name: "Lire", exact: true })
        .getByRole("button", { name: "Mettre en pause" }),
    ).toBeVisible();
    await page.goto("/life/trackers");
    await page.getByRole("button", { name: "Nouveau Tracker" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Titre", { exact: true }).fill("Eau");
    await d.getByLabel("Type", { exact: true }).selectOption("counter");
    await d.getByLabel("Unité", { exact: true }).fill("verres");
    await d.getByLabel("Cible facultative").fill("8");
    await d.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(d).not.toBeVisible();
    await expect(page.getByLabel("Note du jour")).not.toBeVisible();
    await page.getByRole("button", { name: "+1", exact: true }).click();
    await expect(page.locator(".practice-total")).toContainText("1");
    await page.screenshot({
      path: `artifacts/polish-trackers-${device}.png`,
      fullPage: device === "desktop",
    });
    for (const route of ["/planner", "/focus", "/routines"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      if (route === "/planner") {
        await page.getByRole("button", { name: "Day", exact: true }).click();
        await page
          .getByRole("button", { name: "Créer un créneau", exact: true })
          .click();
        const modal = page.getByRole("dialog");
        await modal
          .getByLabel("Titre du créneau", { exact: true })
          .fill("Une courte pause");
        await modal.getByLabel("Durée en minutes", { exact: true }).fill("15");
        await modal
          .getByRole("button", { name: "Enregistrer le créneau" })
          .click();
        await expect(modal).not.toBeVisible();
        await expect(page.locator(".planner-block.is-short strong")).toHaveText(
          "Une courte pause",
        );
        await expect(
          page.locator(".planner-block.is-short>button>span"),
        ).not.toBeVisible();
      }
      if (route === "/focus") {
        await page
          .getByRole("button", { name: "Quick Timer", exact: true })
          .click();
        const modal = page.getByRole("dialog");
        await modal
          .getByLabel("Activité (facultatif pour une source liée)")
          .fill("Un moment de lecture");
        await modal.getByRole("button", { name: "Start", exact: true }).click();
        await expect(modal).not.toBeVisible();
        await expect(
          page.getByRole("button", { name: "Pause", exact: true }),
        ).toBeEnabled();
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/polish-${route.slice(1)}-${device}.png`,
        fullPage: device === "desktop",
      });
    }
  });
}
