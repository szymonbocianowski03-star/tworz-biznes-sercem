import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Layers,
  Video,
  Rocket,
  ChevronsUpDown,
  Plus,
  Check,
  Briefcase,
  Package,
  Users,
  Building2,
  Pencil,
  Plug,
  CreditCard,
  MessageSquareText,
  History,
  CircleHelp,
  LogOut,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { MotivatorButton } from "@/components/MotivatorButton";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { ChatHistoryList } from "@/components/ChatHistoryList";
import { useProducts, type CatalogKind } from "@/hooks/useProducts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useCredits } from "@/hooks/useCredits";
import { CreditsHeaderBadge } from "@/components/CreditsHeaderBadge";
import { NewProductModal } from "@/components/NewProductModal";
import { ProductAvatar } from "@/components/ProductAvatar";
import { readImageAsDataUrl } from "@/lib/readImageAsDataUrl";
import { useChats } from "@/hooks/useChats";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string; icon: typeof Sparkles; badge?: string };

const navBrowse: NavItem[] = [
  { to: "/assets/gallery", label: "Obrazy", icon: Layers },
  { to: "/assets/video", label: "Wideo", icon: Video },
  { to: "/launch", label: "Uruchomienie", icon: MessageSquareText },
  { to: "/campaign-composer", label: "Panel kampanii", icon: Rocket },
  { to: "/integrations", label: "Integracje", icon: Plug },
  { to: "/billing", label: "Plan i kredyty", icon: CreditCard },
];

const navProducts: NavItem[] = [
  { to: "/products/brands", label: "Marki", icon: Building2 },
  { to: "/products/library", label: "Oferta", icon: Package },
  { to: "/products/team", label: "Zespół", icon: Users },
  { to: "/integrations", label: "Integracje", icon: Plug },
  { to: "/billing", label: "Plan i kredyty", icon: CreditCard },
];

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mode: "agent" | "browse" | "products" = pathname.startsWith("/agent")
    ? "agent"
    : pathname.startsWith("/products")
      ? "products"
      : "browse";

  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActive: setActiveWorkspace,
    create: createWorkspace,
    rename: renameWorkspace,
  } = useWorkspace();
  const activeWs = activeWorkspace?.name ?? "Osobiste";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const {
    products,
    active: activeProductObj,
    create: createProduct,
    select: selectProduct,
    update: updateProduct,
  } = useProducts(activeWorkspaceId);
  const activeProduct =
    activeProductObj?.name ?? (activeProductObj?.kind === "service" ? "Nowa usługa" : "Nowy Produkt");
  const catalogProducts = products.filter((p) => p.kind !== "service");
  const catalogServices = products.filter((p) => p.kind === "service");
  const { create: createChat } = useChats(activeProduct);
  const [productOpen, setProductOpen] = useState(false);
  const productWrapRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated } = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);
  const credits = useCredits();
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newItemKind, setNewItemKind] = useState<CatalogKind>("product");
  const [newProductThumbPreview, setNewProductThumbPreview] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);

  const planId = credits.current_plan ?? "free";
  const isFreePlan = planId === "free";
  const freeUsageCents = credits.free_ai_usage_usd_cents ?? 0;
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
      if (productWrapRef.current && !productWrapRef.current.contains(e.target as Node))
        setProductOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const addWorkspace = () => {
    const name = window.prompt("Nazwa nowego workspace");
    if (!name || !name.trim()) return;
    createWorkspace(name.trim());
    setOpen(false);
  };

  const renameWorkspaceByName = (wsId: string, oldName: string) => {
    const name = window.prompt("Nowa nazwa workspace", oldName);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (trimmed === oldName) return;
    if (workspaces.some((w) => w.id !== wsId && w.name === trimmed)) {
      window.alert("Workspace o takiej nazwie już istnieje.");
      return;
    }
    renameWorkspace(wsId, trimmed);
  };

  const openNewItem = (kind: CatalogKind) => {
    setNewItemKind(kind);
    setProductOpen(false);
    setShowNewProduct(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message || "Nie udało się wylogować.");
        return;
      }
      toast.success("Wylogowano.");
      void navigate({ to: "/auth", replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const handleCreateProduct = ({
    name,
    thumbnail,
    brandId,
  }: {
    name: string;
    thumbnail?: string;
    brandId?: string;
  }) => {
    const p = createProduct(name, {
      thumbnail,
      kind: newItemKind,
      brandId,
      workspaceId: activeWorkspaceId ?? undefined,
    });
    selectProduct(p.id);
    setShowNewProduct(false);
    setNewProductThumbPreview(undefined);
    toast.success(newItemKind === "service" ? "Usługa dodana do oferty." : "Produkt dodany do oferty.");
    navigate({ to: "/agent" });
  };

  const uploadActiveProductThumbnail = async (file: File) => {
    if (!activeProductObj) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      updateProduct(activeProductObj.id, { thumbnail: dataUrl, status: "ready" });
      toast.success("Zaktualizowano zdjęcie produktu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wczytać zdjęcia.");
    }
  };

  return (
    <div className="collins-root flex flex-col min-h-screen bg-background text-foreground selection:bg-foreground/10">
      <div className="sticky top-0 z-30 flex flex-col bg-background">
        <div className="h-16 border-b border-foreground/10 bg-background/85 backdrop-blur-md flex items-center px-4 md:px-6 gap-3">
          <MarketingNowLogo size="sm" className="text-foreground shrink-0" />

          <div className="hidden md:flex items-center gap-2">
            <div className="grid grid-cols-3 gap-0.5 rounded-md border border-foreground/10 bg-muted/40 p-0.5 w-[260px]">
              <Link
                to="/assets/gallery"
                className={`text-[11px] font-semibold py-2 rounded-[4px] text-center transition-all ${mode === "browse" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Przeglądaj
              </Link>
              <Link
                to="/products/brands"
                className={`text-[11px] font-semibold py-2 rounded-[4px] text-center transition-all ${mode === "products" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Marki
              </Link>
              <Link
                to="/agent"
                className={`text-[11px] font-semibold py-2 rounded-[4px] text-center transition-all flex items-center justify-center gap-1 ${mode === "agent" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                NOW{" "}
                <span className="text-[8px] px-1 py-px rounded-sm bg-foreground text-background font-bold">
                  AI
                </span>
              </Link>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-0.5 ml-1 lg:ml-2 overflow-x-auto max-w-[min(52vw,520px)] lg:max-w-none min-w-0 mn-nav-scrollbar">
            {[
              { to: "/integrations", label: "Integracje" },
              { to: "/billing", label: "Plan i kredyty" },
              { to: "/assets/gallery", label: "Zasoby" },
              { to: "/campaign-composer", label: "Panel kampanii" },
              { to: "/kalendarz", label: "Kalendarz" },
              { to: "/llm-visibility", label: "Widoczność marki w AI" },
              { to: "/seo", label: "SEO" },
              { to: "/konkurencja", label: "Konkurencja" },
              { to: "/viral-search", label: "Virale" },
              { to: "/agent/skills", label: "Ustawienia" },
            ].map((t) => {
              const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`px-2.5 py-2 rounded-lg text-xs lg:text-sm whitespace-nowrap shrink-0 transition ${
                    active
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {isAuthenticated && (
              <CreditsHeaderBadge
                loading={credits.loading}
                isFreePlan={isFreePlan}
                planId={planId}
                freeUsageCents={freeUsageCents}
                balance={credits.balance ?? null}
              />
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                title={user?.email ? `Wyloguj (${user.email})` : "Wyloguj się"}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                {signingOut ? "…" : "Wyloguj"}
              </button>
            )}
            <a
              href="mailto:support@marketingnow.tech"
              className="inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="Pomoc — napisz na support@marketingnow.tech"
              aria-label="Pomoc — kontakt z supportem"
            >
              <span className="text-[10px] font-semibold leading-none">Pomoc</span>
              <CircleHelp className="h-5 w-5 mt-1" />
            </a>
            <MotivatorButton />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 border-b border-foreground/10 bg-background/75 backdrop-blur-md sticky top-16 z-10 flex items-center px-4 md:px-6 gap-3"
          >
            <div className="relative" ref={wrapRef}>
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md hover:bg-muted"
              >
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                {activeWs}
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {open && (
                <div className="absolute left-0 top-full mt-1.5 w-64 rounded-md border border-foreground/10 bg-background shadow-elevated p-1.5 z-30">
                  <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Workspace
                  </p>
                  <div className="space-y-0.5">
                    {workspaces.map((w) => (
                      <div
                        key={w.id}
                        className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all ${
                          activeWorkspace?.id === w.id
                            ? "bg-muted text-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <button
                          onClick={() => {
                            setActiveWorkspace(w.id);
                            setOpen(false);
                          }}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          <span className="h-5 w-5 rounded-md bg-foreground text-background text-[10px] font-bold flex items-center justify-center shrink-0">
                            {w.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="flex-1 text-left truncate">{w.name}</span>
                          {activeWorkspace?.id === w.id && (
                            <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            renameWorkspaceByName(w.id, w.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0"
                          aria-label={`Zmień nazwę ${w.name}`}
                          title="Zmień nazwę"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="my-1.5 h-px bg-border" />
                  <button
                    onClick={addWorkspace}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-all"
                  >
                    <Plus className="h-4 w-4" /> Nowy workspace
                  </button>
                  {isAuthenticated && (
                    <>
                      <div className="my-1.5 h-px bg-border" />
                      {user?.email ? (
                        <p className="px-2.5 py-1 text-[11px] text-muted-foreground truncate" title={user.email}>
                          {user.email}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          void handleSignOut();
                        }}
                        disabled={signingOut}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {signingOut ? "Wylogowywanie…" : "Wyloguj się"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <span className="text-muted-foreground">/</span>
            <div className="relative" ref={productWrapRef}>
              <button
                onClick={() => setProductOpen((o) => !o)}
                className="flex items-center gap-2 text-sm px-2.5 py-1 rounded-md hover:bg-muted"
              >
                {activeProductObj?.kind === "service" ? (
                  <span className="h-7 w-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                ) : (
                  <ProductAvatar
                    product={activeProductObj}
                    previewUrl={showNewProduct ? newProductThumbPreview : undefined}
                    editable={!!activeProductObj && !showNewProduct}
                    onUpload={uploadActiveProductThumbnail}
                  />
                )}
                {activeProduct} <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {productOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 rounded-md border border-foreground/10 bg-background shadow-elevated p-1.5 z-30">
                  <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Oferta marki
                  </p>
                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                    {products.length === 0 ? (
                      <p className="px-2.5 py-3 text-sm text-muted-foreground">
                        Brak produktów i usług — dodaj pierwszą pozycję.
                      </p>
                    ) : (
                      <>
                        {catalogProducts.length > 0 && (
                          <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                            Produkty
                          </p>
                        )}
                        {catalogProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              selectProduct(p.id);
                              setProductOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all ${
                              activeProductObj?.id === p.id
                                ? "bg-muted text-foreground font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <ProductAvatar product={p} />
                            <span className="flex-1 text-left min-w-0">
                              <span className="block truncate">{p.name}</span>
                            </span>
                            {activeProductObj?.id === p.id && (
                              <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                            )}
                          </button>
                        ))}
                        {catalogServices.length > 0 && (
                          <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                            Usługi
                          </p>
                        )}
                        {catalogServices.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              selectProduct(p.id);
                              setProductOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all ${
                              activeProductObj?.id === p.id
                                ? "bg-muted text-foreground font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className="h-7 w-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                            </span>
                            <span className="flex-1 text-left min-w-0">
                              <span className="block truncate">{p.name}</span>
                            </span>
                            {activeProductObj?.id === p.id && (
                              <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="my-1.5 h-px bg-border" />
                  <button
                    onClick={() => openNewItem("service")}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-all"
                  >
                    <Briefcase className="h-4 w-4" /> Nowa usługa
                  </button>
                  <button
                    onClick={() => openNewItem("product")}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-all"
                  >
                    <Plus className="h-4 w-4" /> Nowy produkt
                  </button>
                  <Link
                    to="/products/brands"
                    onClick={() => setProductOpen(false)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  >
                    <Building2 className="h-4 w-4" /> Zarządzaj markami
                  </Link>
                </div>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {pathname.startsWith("/agent") && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  >
                    <History className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Historia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      createChat(activeProduct);
                      navigate({ to: "/agent" });
                    }}
                    className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  >
                    <MessageSquareText className="h-4 w-4 shrink-0" />{" "}
                    <span className="hidden sm:inline">Nowy czat</span>
                    <span className="sm:hidden">+</span>
                  </button>
                </>
              )}
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
        <NewProductModal
          open={showNewProduct}
          kind={newItemKind}
          workspaceId={activeWorkspaceId}
          onClose={() => {
            setShowNewProduct(false);
            setNewProductThumbPreview(undefined);
          }}
          onCreate={handleCreateProduct}
          onThumbnailPreview={setNewProductThumbPreview}
        />

        {showHistory && (
          <div className="fixed inset-0 z-50">
            <button
              className="absolute inset-0 bg-black/35"
              onClick={() => setShowHistory(false)}
              aria-label="Zamknij historię"
            />
            <aside className="absolute left-0 top-0 h-full w-full max-w-sm bg-background border-r border-border shadow-elevated flex flex-col">
              <div className="h-14 px-4 flex items-center justify-between border-b border-border">
                <p className="text-sm font-semibold">Historia czatów</p>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Zamknij
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatHistoryList product={activeProduct} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
