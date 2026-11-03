import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AngelWings, Diamond, Crystal } from "../../design-system/components/ornaments";
import { Badge, EmptyState } from "../../design-system/components/primitives";
import type { Destination } from "./navigation";
export function PageLayout({
  title,
  subtitle,
  eyebrow = "VOTRE ESPACE, À VOTRE IMAGE",
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
export function PageShell({ destination }: { destination: Destination }) {
  const Icon = destination.icon;
  return (
    <PageLayout
      title={destination.label}
      subtitle={destination.description}
      actions={<Badge tone="rose">À venir</Badge>}
    >
      <section
        className="shell-stage"
        aria-label={`${destination.label} — aperçu de la page`}
      >
        <div className="stage-topline">
          <span>
            <Icon size={16} aria-hidden="true" />
            {destination.label}
          </span>
          <Diamond />
        </div>
        <div className="angel-signature">
          <AngelWings />
          <Crystal className="signature-crystal" />
        </div>
        <EmptyState icon={<Diamond />} title={destination.emptyTitle}>
          {destination.detail}
        </EmptyState>
        <div className="stage-footnote">
          <span>Un espace en préparation.</span>
          <span>Vos données y trouveront leur place.</span>
        </div>
      </section>
      <div className="page-bottom">
        <p>
          <Diamond /> Pensé pour vous. Créé à votre rythme.
        </p>
        <Link to="/design-system">
          Découvrir le Design System{" "}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </PageLayout>
  );
}
