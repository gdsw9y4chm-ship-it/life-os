import { TimerStrip } from "../../features/time/provider";
import { TaskSearchResults } from "../../features/tasks/search";
import { useHydrated } from "../../lib/use-hydrated";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Search,
  Menu,
  ChevronDown,
  ArrowUpRight,
  PanelTop,
} from "lucide-react";
import type { User } from "../../types/user";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Input,
} from "../../design-system/components/primitives";
import { Dialog, Sheet } from "../../design-system/components/overlays";
import { Diamond } from "../../design-system/components/ornaments";
import { destinations, NavigationItem } from "./navigation";
import { QuickAdd } from "./quick-add";

export function AppShell({
  user,
  profileUnavailable,
  children,
}: {
  user: User | null;
  profileUnavailable: boolean;
  children: ReactNode;
}) {
  const hydrated = useHydrated();
  const location = useLocation();
  const current =
    destinations.find(
      (item) =>
        item.to === location.pathname ||
        location.pathname.startsWith(`${item.to}/`),
    )?.label || (location.pathname === "/focus" ? "Focus" : "Design System");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = destinations.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );
  const profile = (
    <Dialog
      title="Votre profil"
      description="Préférences enregistrées dans votre espace local."
      trigger={
        <button
          type="button"
          className="profile-trigger"
          disabled={!hydrated}
          aria-label="Ouvrir le profil"
        >
          <Avatar name={user?.name || "?"} src={user?.avatar} />
          <span>
            <strong>{user?.name || "Profil indisponible"}</strong>
            <small>Mon espace personnel</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      }
    >
      {user ? (
        <dl className="profile-details">
          <div>
            <dt>Nom</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Thème</dt>
            <dd>{user.theme}</dd>
          </div>
          <div>
            <dt>Fuseau horaire</dt>
            <dd>{user.timezone}</dd>
          </div>
          <div>
            <dt>Langue</dt>
            <dd>{user.locale}</dd>
          </div>
          <div>
            <dt>Début de semaine</dt>
            <dd>{user.week_start}</dd>
          </div>
        </dl>
      ) : (
        <p role="status">
          {profileUnavailable
            ? "Impossible de charger le profil pour le moment."
            : "Aucun profil initialisé."}
        </p>
      )}
    </Dialog>
  );
  const search = (
    <Dialog
      title="Explorer Life OS"
      description="Recherchez une page ou une tâche par titre et description."
      open={searchOpen}
      onOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) setQuery("");
      }}
      trigger={
        <button type="button" className="search-trigger" disabled={!hydrated}>
          <Search size={18} aria-hidden="true" />
          <span>Search</span>
        </button>
      }
    >
      <Input
        label="Rechercher une page ou une tâche"
        placeholder="Pages, titres, descriptions…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <nav aria-label="Résultats de recherche" className="search-results">
        {filtered.map((item) => (
          <NavigationItem
            key={item.to}
            {...item}
            onNavigate={() => setSearchOpen(false)}
          />
        ))}
        {!filtered.length && <p role="status">Aucune page trouvée.</p>}
      </nav>
      <TaskSearchResults
        query={query}
        onNavigate={() => setSearchOpen(false)}
      />
    </Dialog>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <Link to="/today" className="brand" aria-label="Life OS — Today">
          <span className="brand-wordmark">
            <span className="brand-angel">Angel</span>
            <span className="brand-name">LIFE OS</span>
            <small>THE JADE EDITION</small>
          </span>
        </Link>
        <div className="sidebar-search">{search}</div>
        <p className="nav-caption">VOTRE ESPACE</p>
        <nav aria-label="Navigation principale" className="primary-navigation">
          {destinations.map((item) => (
            <NavigationItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="sidebar-bottom">
          <TimerStrip />
          <Link className="system-link" to="/design-system">
            <PanelTop size={16} />
            Design System
            <ArrowUpRight size={14} />
          </Link>
          {profile}
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Mon espace</span>
            <span aria-hidden="true">/</span>
            <strong>{current}</strong>
          </div>
          <div className="mobile-brand">
            <Diamond />
            <span>LIFE OS</span>
          </div>
          <div className="topbar-actions">
            <span className="edition-label">
              PERSONAL SPACE, BEAUTIFULLY YOURS
            </span>
            <div className="desktop-quick">
              <QuickAdd />
            </div>
            <div className="mobile-menu">
              <Sheet
                title="Votre espace"
                description="Toutes les pages de Life OS."
                open={menuOpen}
                onOpenChange={setMenuOpen}
                trigger={
                  <IconButton label="Ouvrir le menu">
                    <Menu size={22} />
                  </IconButton>
                }
              >
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(true);
                  }}
                >
                  Search
                </Button>
                <nav aria-label="Toutes les pages">
                  {destinations.map((item) => (
                    <NavigationItem
                      key={item.to}
                      {...item}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ))}
                  <Link
                    to="/design-system"
                    className="system-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <PanelTop size={18} />
                    Design System
                  </Link>
                </nav>
                <section className="mobile-profile" aria-label="Votre profil">
                  <h3>Votre profil</h3>
                  {user ? (
                    <>
                      <div className="demo-row">
                        <Avatar name={user.name} src={user.avatar} />
                        <strong>{user.name}</strong>
                      </div>
                      <dl className="profile-details">
                        <div>
                          <dt>Thème</dt>
                          <dd>{user.theme}</dd>
                        </div>
                        <div>
                          <dt>Fuseau horaire</dt>
                          <dd>{user.timezone}</dd>
                        </div>
                        <div>
                          <dt>Langue</dt>
                          <dd>{user.locale}</dd>
                        </div>
                        <div>
                          <dt>Début de semaine</dt>
                          <dd>{user.week_start}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p>
                      {profileUnavailable
                        ? "Profil indisponible pour le moment."
                        : "Aucun profil initialisé."}
                    </p>
                  )}
                </section>
              </Sheet>
            </div>
          </div>
        </header>
        {profileUnavailable && (
          <div className="profile-warning" role="status">
            Le profil local n’a pas pu être chargé.{" "}
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="shell-footer">
          <span>
            LIFE OS <span aria-hidden="true">·</span> THE JADE EDITION
          </span>
          <Badge>Votre espace personnel</Badge>
        </footer>
      </div>
      <TimerStrip mobile />
      <nav aria-label="Navigation mobile" className="bottom-nav">
        <NavigationItem {...destinations[0]} compact />
        <NavigationItem {...destinations[1]} compact />
        <QuickAdd mobile />
        <NavigationItem {...destinations[2]} compact />
        <NavigationItem {...destinations[6]} compact />
      </nav>
    </div>
  );
}
