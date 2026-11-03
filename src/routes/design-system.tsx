import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Info,
  MoreHorizontal,
  Plus,
  Sparkles,
} from "lucide-react";
import { PageLayout } from "../components/layout/page-shell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  IconButton,
  Input,
  Progress,
  Section,
  Select,
  Textarea,
  Toggle,
} from "../design-system/components/primitives";
import {
  Dialog,
  Dropdown,
  Sheet,
  Tabs,
  Tooltip,
} from "../design-system/components/overlays";
import { AngelWings, Diamond } from "../design-system/components/ornaments";
export const Route = createFileRoute("/design-system")({
  component: DesignSystem,
  head: () => ({ meta: [{ title: "Design System · Life OS" }] }),
});
function DesignSystem() {
  const [selection, setSelection] = useState("Confortable");
  const [checked, setChecked] = useState(false);
  return (
    <PageLayout
      title="The details"
      subtitle="Le langage visuel de Life OS. Une bibliothèque de composants, pas des données métier."
      eyebrow="JADE DESIGN SYSTEM"
      actions={<Badge tone="dark">Phase 2</Badge>}
    >
      <Tabs
        label="Bibliothèque de composants"
        tabs={[
          {
            value: "identity",
            label: "Identité",
            content: (
              <>
                <Section
                  title="Une palette, plusieurs nuances"
                  description="Du blush pour la douceur. Du noir pour le caractère."
                >
                  <Card>
                    <div className="palette">
                      {[
                        ["Blush", "--color-blush"],
                        ["Lingerie", "--color-lingerie"],
                        ["Dusty rose", "--color-dusty-rose"],
                        ["Crème", "--color-cream"],
                        ["Noir", "--color-black"],
                        ["Argent", "--color-silver"],
                      ].map(([name, token]) => (
                        <div className="swatch" key={name}>
                          <div
                            className="swatch-color"
                            style={{ background: `var(${token})` }}
                          />
                          <span>{name}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Section>
                <div className="demo-grid">
                  <Section title="La signature">
                    <Card>
                      <p className="demo-display">Today, beautifully.</p>
                      <p>Great Vibes · grands titres uniquement</p>
                      <Divider />
                      <p>Manrope · Une interface claire et lisible.</p>
                      <small>Polices libres, disponibles hors ligne.</small>
                    </Card>
                  </Section>
                  <Section title="Les détails Angel">
                    <Card>
                      <AngelWings />
                      <div className="demo-row">
                        <Diamond />
                        <Badge tone="rose">Angel / Diamond</Badge>
                      </div>
                      <p className="demo-note">
                        Plumes blanches aériennes et facettes précieuses. Des
                        accents, jamais des récompenses.
                      </p>
                    </Card>
                  </Section>
                </div>
              </>
            ),
          },
          {
            value: "controls",
            label: "Composants",
            content: (
              <>
                <Section
                  title="Actions & états"
                  description="Des exemples isolés, sans enregistrement de données."
                >
                  <Card>
                    <div className="demo-row">
                      <Button>
                        <Plus size={16} />
                        Principal
                      </Button>
                      <Button variant="secondary">Secondaire</Button>
                      <Button variant="ghost">
                        Discret
                        <ArrowUpRight size={16} />
                      </Button>
                      <Tooltip content="Une infobulle accessible au clavier.">
                        <IconButton label="Information">
                          <Info size={18} />
                        </IconButton>
                      </Tooltip>
                    </div>
                    <div className="demo-row">
                      <Button disabled>Indisponible</Button>
                      <Button loading>Chargement</Button>
                      <Badge>Neutre</Badge>
                      <Badge tone="rose">Sélectionné</Badge>
                      <Badge tone="dark">Contraste</Badge>
                    </div>
                  </Card>
                </Section>
                <Section title="Champs & préférences">
                  <div className="demo-grid">
                    <Card>
                      <Input
                        label="Champ de démonstration"
                        placeholder="Écrivez ici…"
                        hint="Cet exemple reste dans la page."
                      />
                      <Input
                        label="Champ en erreur"
                        error="Exemple : ce champ est requis."
                      />
                      <Input
                        label="Champ désactivé"
                        disabled
                        placeholder="Indisponible"
                      />
                    </Card>
                    <Card>
                      <Textarea
                        label="Texte de démonstration"
                        placeholder="Un espace pour quelques mots…"
                      />
                      <Select
                        label="Densité de démonstration"
                        value={selection}
                        onChange={(event) => setSelection(event.target.value)}
                      >
                        <option>Confortable</option>
                        <option>Compacte</option>
                      </Select>
                      <Checkbox
                        label="Exemple de case à cocher"
                        checked={checked}
                        onChange={(event) => setChecked(event.target.checked)}
                      />
                      <Toggle label="Exemple d’interrupteur" />
                      <Checkbox label="Case indisponible" disabled />
                    </Card>
                  </div>
                </Section>
                <Section title="Indicateurs">
                  <Card>
                    <div className="demo-row">
                      <Avatar name="Exemple" />
                      <Badge tone="rose">Aperçu de composant</Badge>
                    </div>
                    <Progress
                      label="Exemple de progression UI : 60 %"
                      value={60}
                    />
                    <Divider />
                    <EmptyState
                      icon={<Diamond />}
                      title="Un espace à imaginer."
                    >
                      Un exemple d’état vide, prêt à accueillir un contexte
                      réel.
                    </EmptyState>
                  </Card>
                </Section>
              </>
            ),
          },
          {
            value: "overlays",
            label: "Interactions",
            content: (
              <Section
                title="Dialogues, sheets & menus"
                description="Ouverture au clavier, focus contenu et fermeture avec Échap."
              >
                <Card>
                  <div className="demo-row">
                    <Dialog
                      title="Un dialogue Jade"
                      description="Exemple de dialogue. Aucune donnée n’est enregistrée."
                      trigger={
                        <Button variant="secondary">Ouvrir le dialogue</Button>
                      }
                    >
                      <Input
                        label="Champ dans le dialogue"
                        placeholder="Tester le focus…"
                      />
                      <p className="demo-note">
                        Échap ferme le dialogue et rend le focus au bouton
                        d’ouverture.
                      </p>
                    </Dialog>
                    <Sheet
                      title="Une sheet Jade"
                      description="Une surface adaptée au mobile, avec défilement indépendant."
                      trigger={
                        <Button variant="secondary">Ouvrir la sheet</Button>
                      }
                    >
                      <EmptyState
                        icon={<Sparkles />}
                        title="De la place pour l’essentiel."
                      >
                        Ce composant accueillera les interactions des prochaines
                        phases.
                      </EmptyState>
                    </Sheet>
                    <Dropdown
                      trigger={
                        <Button variant="secondary">
                          Options
                          <MoreHorizontal size={16} />
                        </Button>
                      }
                      items={[
                        {
                          label: "Confortable",
                          selected: selection === "Confortable",
                          onSelect: () => setSelection("Confortable"),
                        },
                        {
                          label: "Compacte",
                          selected: selection === "Compacte",
                          onSelect: () => setSelection("Compacte"),
                        },
                        {
                          label: "À venir",
                          disabled: true,
                          onSelect: () => {},
                        },
                      ]}
                    />
                  </div>
                  <p role="status" className="demo-note">
                    <Check size={14} aria-hidden="true" /> Sélection de
                    démonstration : {selection}
                  </p>
                </Card>
              </Section>
            ),
          },
        ]}
      />
    </PageLayout>
  );
}
