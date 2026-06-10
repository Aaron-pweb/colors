"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  Code,
  Copy,
  DiceFive,
  DownloadSimple,
  FileCode,
  Heart,
  Info,
  MagnifyingGlass,
  Moon,
  Sun,
  X,
} from "@phosphor-icons/react";
import {
  PALETTES,
  PALETTE_COUNT,
  PaletteFilter,
  hexToRgb,
  matchesFilter,
  matchesSearch,
  readableOn,
  rgbToHsl,
  rgbToHsv,
} from "../lib/palettes";

type Toast =
  | { kind: "hex"; hex: string; at: number }
  | { kind: "palette"; palette: string[]; at: number }
  | { kind: "value"; hex: string; label: string; value: string; at: number };

const FAVORITES_KEY = "colors:favorites";
const THEME_KEY = "colors:theme";

export default function PaletteGrid() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<PaletteFilter>("all");
  const [isDark, setIsDark] = useState(false);
  const cardsRef = useRef<Array<HTMLDivElement | null>>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load theme & favorites from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialDark = savedTheme ? savedTheme === "dark" : systemDark;
      setIsDark(initialDark);
      if (initialDark) document.documentElement.classList.add("dark");

      const raw = localStorage.getItem(FAVORITES_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setFavorites(new Set(arr.filter((n) => typeof n === "number")));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
    } catch {
      // ignore quota errors
    }
  }, [favorites]);

  const toggleFavorite = useCallback((idx: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // History of Random picks; pos points at the currently-shown entry.
  // Named `picks` (not `history`) to avoid shadowing window.history.
  const [picks, setPicks] = useState<{ stack: number[]; pos: number }>({
    stack: [],
    pos: -1,
  });
  const canUndo = picks.pos > 0;
  const canRedo = picks.pos >= 0 && picks.pos < picks.stack.length - 1;

  const copyHex = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      // best-effort
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind: "hex", hex, at: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  }, []);

  const copyValue = useCallback(
    async (hex: string, label: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // best-effort
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ kind: "value", hex, label, value, at: Date.now() });
      toastTimer.current = setTimeout(() => setToast(null), 1400);
    },
    [],
  );

  const copyAll = useCallback(async (palette: string[]) => {
    const text = palette.map((h) => h.toUpperCase()).join(", ");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // best-effort
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind: "palette", palette, at: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const goTo = useCallback((idx: number) => {
    const el = cardsRef.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(idx);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlight(null), 2600);
  }, []);

  const randomize = useCallback(() => {
    const pool: number[] = [];
    for (let i = 0; i < PALETTES.length; i++) {
      if (!favorites.has(i)) pool.push(i);
    }
    if (pool.length === 0) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    goTo(next);
    setPicks((p) => ({
      stack: [...p.stack.slice(0, p.pos + 1), next],
      pos: p.pos + 1,
    }));
  }, [goTo, favorites]);

  const undo = useCallback(() => {
    if (picks.pos <= 0) return;
    const newPos = picks.pos - 1;
    goTo(picks.stack[newPos]);
    setPicks({ stack: picks.stack, pos: newPos });
  }, [picks, goTo]);

  const redo = useCallback(() => {
    if (picks.pos >= picks.stack.length - 1) return;
    const newPos = picks.pos + 1;
    goTo(picks.stack[newPos]);
    setPicks({ stack: picks.stack, pos: newPos });
  }, [picks, goTo]);

  // Deep link via #p123
  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#p(\d+)$/);
      if (!m) return;
      const idx = Math.max(0, Math.min(PALETTES.length - 1, parseInt(m[1], 10) - 1));
      // delay so layout settles
      setTimeout(() => goTo(idx), 60);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [goTo]);

  // Keyboard: R = random, ? = help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "r" || e.key === "R" || e.code === "Space") {
        e.preventDefault();
        randomize();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [randomize]);

  const filteredPalettes = PALETTES.map((p, i) => ({ palette: p, index: i })).filter(
    ({ palette, index }) => {
      if (showFavoritesOnly && !favorites.has(index)) return false;
      if (activeFilter !== "all" && !matchesFilter(palette, activeFilter)) return false;
      if (searchQuery && !matchesSearch(palette, index, searchQuery)) return false;
      return true;
    },
  );

  return (
    <>
      <Header
        onRandom={randomize}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        favoritesCount={favorites.size}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFilter={() => setShowFavoritesOnly((v) => !v)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="px-4 sm:px-8 pb-32 pt-4">
        {filteredPalettes.length === 0 ? (
          <div className="mt-24 mx-auto max-w-prose text-center text-sm text-neutral-500 dark:text-neutral-400">
            {showFavoritesOnly && favorites.size === 0
              ? "No favorites yet. Tap the heart on any palette to save it here."
              : "No palettes found for your search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6">
            {filteredPalettes.map(({ palette, index }) => (
              <PaletteCard
                key={index}
                ref={(el) => {
                  cardsRef.current[index] = el;
                }}
                palette={palette}
                index={index}
                highlighted={highlight === index}
                dimmed={highlight !== null && highlight !== index}
                isFavorite={favorites.has(index)}
                onCopy={copyHex}
                onCopyAll={copyAll}
                onToggleFavorite={toggleFavorite}
                onOpenInfo={() => setInfoOpen(index)}
              />
            ))}
          </div>
        )}

        <footer className="mt-20 mx-auto max-w-prose text-center text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          {PALETTE_COUNT} palettes curated by{" "}
          <a
            href="https://github.com/Experience-Monks/nice-color-palettes"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-neutral-900 dark:hover:decoration-neutral-200 underline-offset-2 transition-colors"
          >
            nice-color-palettes
          </a>
          , sourced from{" "}
          <a
            href="https://www.colourlovers.com/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-neutral-900 dark:hover:decoration-neutral-200 underline-offset-2 transition-colors"
          >
            COLOURlovers
          </a>
          . Press <Kbd>R</Kbd> or <Kbd>Space</Kbd> to jump to a random one.
          <div className="mt-2">
            Made by{" "}
            <a
              href="https://robi.work"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-neutral-900 dark:hover:decoration-neutral-200 underline-offset-2 transition-colors"
            >
              robi.work
            </a>
          </div>
        </footer>
      </main>

      <InfoModal
        index={infoOpen}
        palette={infoOpen !== null ? PALETTES[infoOpen] : null}
        onClose={() => setInfoOpen(null)}
        onCopyValue={copyValue}
      />

      {toast && (
        <div
          aria-live="polite"
          className="toast fixed top-6 left-1/2 -translate-x-1/2 z-50"
          key={toast.at}
        >
          <div className="flex items-center gap-2 rounded-md bg-primary text-white pl-2 pr-4 py-2 shadow-lg shadow-black/15">
            {toast.kind === "hex" && (
              <>
                <span
                  className="inline-block size-5 rounded-sm ring-1 ring-white/20"
                  style={{ background: toast.hex }}
                />
                <span className="font-mono text-xs tabular-nums">
                  {toast.hex.toUpperCase()}
                </span>
                <span className="text-xs text-neutral-300 pl-2 border-l border-white/15">
                  copied
                </span>
              </>
            )}
            {toast.kind === "palette" && (
              <>
                <span className="inline-flex h-5 rounded-sm overflow-hidden ring-1 ring-white/20">
                  {toast.palette.map((hex, i) => (
                    <span
                      key={i}
                      className="block h-5 w-5"
                      style={{ background: hex }}
                    />
                  ))}
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {toast.palette.length} hex
                </span>
                <span className="text-xs text-neutral-300 pl-2 border-l border-white/15">
                  copied
                </span>
              </>
            )}
            {toast.kind === "value" && (
              <>
                <span
                  className="inline-block size-5 rounded-sm ring-1 ring-white/20"
                  style={{ background: toast.hex }}
                />
                <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">
                  {toast.label}
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {toast.value}
                </span>
                <span className="text-xs text-neutral-300 pl-2 border-l border-white/15">
                  copied
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Header({
  onRandom,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  favoritesCount,
  showFavoritesOnly,
  onToggleFilter,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  isDark,
  onToggleTheme,
}: {
  onRandom: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  favoritesCount: number;
  showFavoritesOnly: boolean;
  onToggleFilter: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: PaletteFilter;
  onFilterChange: (f: PaletteFilter) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const filters: Array<{ id: PaletteFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "warm", label: "Warm" },
    { id: "cool", label: "Cool" },
    { id: "monochrome", label: "Monochrome" },
    { id: "contrast", label: "Contrast" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border)] transition-colors duration-300">
      <div className="px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
              if (typeof history !== "undefined") history.replaceState(null, "", " ");
            }}
            className="font-semibold tracking-tight text-primary text-[15px] hover:scale-105 transition-transform"
          >
            Colors
          </a>
          <span className="hidden lg:inline text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {PALETTE_COUNT} palettes
          </span>
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: "smooth",
              })
            }
            className="flex items-center justify-center size-6 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="About — scroll to bottom"
            title="About"
          >
            <InfoIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 max-w-md relative group">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search hex, ID, or color..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-8 bg-[var(--input-bg)] border-transparent focus:bg-[var(--card-bg)] focus:ring-2 focus:ring-primary/20 focus:border-primary/30 rounded-md text-sm transition-all outline-none text-[var(--foreground)]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
              aria-label="Clear search"
            >
              <CloseIcon className="size-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleTheme}
            className="inline-flex items-center justify-center size-9 rounded-md text-neutral-500 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-90 transition-all"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </button>

          {favoritesCount > 0 && (
            <button
              onClick={onToggleFilter}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium active:scale-[0.97] transition-all ${
                showFavoritesOnly
                  ? "bg-primary text-white"
                  : "text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
              aria-pressed={showFavoritesOnly}
              aria-label={
                showFavoritesOnly
                  ? "Show all palettes"
                  : "Show favorites only"
              }
            >
              <HeartIcon filled className="size-4" />
              <span className="tabular-nums hidden sm:inline">{favoritesCount}</span>
            </button>
          )}

          <div className="hidden sm:flex items-center">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex items-center justify-center size-9 rounded-md text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:text-neutral-300 dark:disabled:text-neutral-700 disabled:hover:bg-transparent disabled:cursor-not-allowed active:scale-90 transition-all"
              aria-label="Previous random palette"
            >
              <UndoIcon className="size-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="inline-flex items-center justify-center size-9 rounded-md text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:text-neutral-300 dark:disabled:text-neutral-700 disabled:hover:bg-transparent disabled:cursor-not-allowed active:scale-90 transition-all"
              aria-label="Next random palette"
            >
              <RedoIcon className="size-4" />
            </button>
          </div>

          <button
            onClick={onRandom}
            className="group inline-flex items-center gap-2 rounded-md bg-primary text-white text-sm font-medium pl-3 pr-4 h-9 hover:bg-primary/85 active:scale-[0.98] transition"
            aria-label="Jump to a random palette"
          >
            <DiceIcon className="size-4 transition-transform group-hover:rotate-[14deg]" />
            <span className="hidden sm:inline">Random</span>
            <span className="hidden md:inline text-[10px] uppercase tracking-wider text-white/50 ml-1">
              R
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-8 h-10 flex items-center border-t border-[var(--border)] overflow-x-auto no-scrollbar transition-colors">
        <div className="flex items-center gap-1 py-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`whitespace-nowrap px-3 h-7 rounded-full text-[12px] font-medium transition-all hover:scale-105 active:scale-95 ${
                activeFilter === f.id
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-black"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

type CardProps = {
  palette: string[];
  index: number;
  highlighted: boolean;
  dimmed: boolean;
  isFavorite: boolean;
  onCopy: (hex: string) => void;
  onCopyAll: (palette: string[]) => void;
  onToggleFavorite: (idx: number) => void;
  onOpenInfo: () => void;
};

const PaletteCard = function PaletteCard({
  palette,
  index,
  highlighted,
  dimmed,
  isFavorite,
  onCopy,
  onCopyAll,
  onToggleFavorite,
  onOpenInfo,
  ref,
}: CardProps & { ref?: React.Ref<HTMLDivElement> }) {
  const href = `#p${index + 1}`;
  return (
    <div
      ref={ref}
      id={`p${index + 1}`}
      onClick={() => {
        if (typeof history !== "undefined") {
          history.replaceState(null, "", href);
        }
      }}
      className={`group block rounded-lg overflow-hidden bg-[var(--card-bg)] border border-[var(--border)] transition-all duration-300 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 hover:-translate-y-1 cursor-default ${
        highlighted ? "ring-1 ring-primary" : ""
      } ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <div className="flex h-44 sm:h-52">
        {palette.map((hex, i) => (
          <Swatch key={i} hex={hex} onCopy={onCopy} />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-mono text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
          #{(index + 1).toString().padStart(4, "0")}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInfo();
            }}
            className="flex items-center justify-center size-7 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="Show color details"
          >
            <InfoIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(index);
            }}
            className={`flex items-center justify-center size-7 rounded-sm transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-black/20 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
              isFavorite
                ? "text-primary"
                : "text-neutral-400 dark:text-neutral-500 hover:text-primary"
            }`}
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={isFavorite}
          >
            <HeartIcon filled={isFavorite} className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyAll(palette);
            }}
            className="-mr-1 flex items-center justify-center size-7 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="Copy all hex codes"
            title="Select all"
          >
            <CopyIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

function Swatch({
  hex,
  onCopy,
}: {
  hex: string;
  onCopy: (hex: string) => void;
}) {
  const mode = readableOn(hex);
  const fg = mode === "light" ? "text-white/90" : "text-black/80";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCopy(hex.toUpperCase());
      }}
      className={`group/sw relative grow basis-0 flex items-end justify-center pb-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-inset focus-visible:ring-black/30 transition-all duration-300 ease-out hover:grow-[2] active:scale-95`}
      style={{ background: hex }}
      aria-label={`Copy ${hex.toUpperCase()}`}
    >
      <span
        className={`font-mono text-[10px] tracking-wider uppercase opacity-0 group-hover/sw:opacity-100 transition-all duration-300 transform translate-y-1 group-hover/sw:translate-y-0 ${fg}`}
      >
        {hex.replace("#", "")}
      </span>
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center align-middle px-1.5 min-w-[1.4rem] h-5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono text-neutral-700 dark:text-neutral-300 mx-0.5 transition-colors">
      {children}
    </kbd>
  );
}

function InfoModal({
  index,
  palette,
  onClose,
  onCopyValue,
}: {
  index: number | null;
  palette: string[] | null;
  onClose: () => void;
  onCopyValue: (hex: string, label: string, value: string) => void;
}) {
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  useEffect(() => {
    if (index === null) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, onClose]);

  const showToast = (msg: string) => {
    setExportToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setExportToast(null), 2000);
  };

  const copyAsCSS = async () => {
    if (!palette) return;
    const css = palette
      .map((hex, i) => `  --color-${i + 1}: ${hex.toUpperCase()};`)
      .join("\n");
    const text = `:root {\n${css}\n}`;
    await navigator.clipboard.writeText(text);
    showToast("CSS copied");
  };

  const copyAsTailwind = async () => {
    if (!palette) return;
    const obj = palette.reduce((acc, hex, i) => {
      acc[`color-${i + 1}`] = hex.toUpperCase();
      return acc;
    }, {} as any);
    const text = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify(obj, null, 2)}\n    }\n  }\n}`;
    await navigator.clipboard.writeText(text);
    showToast("Tailwind config copied");
  };

  const copyAsJSON = async () => {
    if (!palette) return;
    await navigator.clipboard.writeText(JSON.stringify(palette, null, 2));
    showToast("JSON copied");
  };

  const downloadSVG = () => {
    if (!palette || index === null) return;
    const size = 100;
    const sw = size / palette.length;
    const rects = palette
      .map(
        (hex, i) =>
          `<rect x="${i * sw}" y="0" width="${sw}" height="${size}" fill="${hex}" />`,
      )
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${rects}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palette-${(index + 1).toString().padStart(4, "0")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (index === null || palette === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette details"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-md shadow-xl no-scrollbar animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 flex items-start justify-between px-5 pt-5 pb-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-800 transition-colors">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Palette
            </div>
            <div className="font-mono text-base text-primary tabular-nums">
              #{(index + 1).toString().padStart(4, "0")}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {exportToast && (
              <span className="text-[11px] font-medium text-primary bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-sm animate-in fade-in slide-in-from-right-2">
                {exportToast}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 flex items-center justify-center size-8 rounded-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-black/20"
              aria-label="Close"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {palette.map((hex, i) => (
            <ColorDetail key={i} hex={hex} onCopyValue={onCopyValue} />
          ))}
        </div>

        <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 transition-colors">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-3">
            Export Palette
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ExportButton
              icon={<CodeIcon />}
              label="CSS"
              onClick={copyAsCSS}
              title="Copy as CSS variables"
            />
            <ExportButton
              icon={<TailwindIcon />}
              label="Tailwind"
              onClick={copyAsTailwind}
              title="Copy Tailwind config"
            />
            <ExportButton
              icon={<JSONIcon />}
              label="JSON"
              onClick={copyAsJSON}
              title="Copy as JSON array"
            />
            <ExportButton
              icon={<DownloadIcon />}
              label="SVG"
              onClick={downloadSVG}
              title="Download as SVG"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportButton({
  icon,
  label,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-all active:scale-[0.97]"
    >
      <span className="text-neutral-400 dark:text-neutral-500 group-hover:text-primary">{icon}</span>
      {label}
    </button>
  );
}

function ColorDetail({
  hex,
  onCopyValue,
}: {
  hex: string;
  onCopyValue: (hex: string, label: string, value: string) => void;
}) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const rows: Array<[string, string]> = [
    ["HEX", hex.replace("#", "").toUpperCase()],
    ["RGB", `${r}, ${g}, ${b}`],
    ["HSL", `${hsl.h}° ${hsl.s}% ${hsl.l}%`],
    ["HSV", `${hsv.h}° ${hsv.s}% ${hsv.v}%`],
  ];
  return (
    <div className="rounded-sm overflow-hidden border border-neutral-100 dark:border-neutral-800 transition-colors">
      <div className="h-16" style={{ background: hex }} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-2 px-3 py-3 bg-white dark:bg-neutral-900 transition-colors">
        {rows.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => onCopyValue(hex, label, value)}
            className="group/v text-left px-2 py-1 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label={`Copy ${label} ${value}`}
          >
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-medium">
              {label}
              <CopyIcon className="size-3 opacity-0 group-hover/v:opacity-100 transition" />
            </div>
            <div className="font-mono text-xs text-neutral-700 dark:text-neutral-300 tabular-nums">
              {value}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return <Info weight="duotone" className={className} aria-hidden="true" />;
}

function CopyIcon({ className }: { className?: string }) {
  return <Copy weight="duotone" className={className} aria-hidden="true" />;
}

function CloseIcon({ className }: { className?: string }) {
  return <X weight="duotone" className={className} aria-hidden="true" />;
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <ArrowUUpLeft weight="duotone" className={className} aria-hidden="true" />
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <ArrowUUpRight weight="duotone" className={className} aria-hidden="true" />
  );
}

function HeartIcon({
  filled,
  className,
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <Heart
      weight={filled ? "fill" : "duotone"}
      className={className}
      aria-hidden="true"
    />
  );
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <DiceFive weight="duotone" className={className} aria-hidden="true" />
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <MagnifyingGlass weight="bold" className={className} aria-hidden="true" />
  );
}

function MoonIcon({ className }: { className?: string }) {
  return <Moon weight="bold" className={className} aria-hidden="true" />;
}

function SunIcon({ className }: { className?: string }) {
  return <Sun weight="bold" className={className} aria-hidden="true" />;
}

function CodeIcon() {
  return <Code weight="bold" className="size-3.5" />;
}

function TailwindIcon() {
  return <FileCode weight="bold" className="size-3.5" />;
}

function JSONIcon() {
  return <FileCode weight="duotone" className="size-3.5" />;
}

function DownloadIcon() {
  return <DownloadSimple weight="bold" className="size-3.5" />;
}
