"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  Copy,
  DiceFive,
  Heart,
  Info,
  X,
} from "@phosphor-icons/react";
import {
  PALETTES,
  PALETTE_COUNT,
  hexToRgb,
  readableOn,
  rgbToHsl,
  rgbToHsv,
} from "../lib/palettes";

type Toast =
  | { kind: "hex"; hex: string; at: number }
  | { kind: "palette"; palette: string[]; at: number }
  | { kind: "value"; hex: string; label: string; value: string; at: number };

const FAVORITES_KEY = "colors:favorites";

export default function PaletteGrid() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const cardsRef = useRef<Array<HTMLAnchorElement | null>>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
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
      />

      <main className="px-4 sm:px-8 pb-32 pt-4">
        {showFavoritesOnly && favorites.size === 0 ? (
          <div className="mt-24 mx-auto max-w-prose text-center text-sm text-neutral-500">
            No favorites yet. Tap the heart on any palette to save it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6">
            {PALETTES.map((palette, idx) => {
              if (showFavoritesOnly && !favorites.has(idx)) return null;
              return (
                <PaletteCard
                  key={idx}
                  ref={(el) => {
                    cardsRef.current[idx] = el;
                  }}
                  palette={palette}
                  index={idx}
                  highlighted={highlight === idx}
                  dimmed={highlight !== null && highlight !== idx}
                  isFavorite={favorites.has(idx)}
                  onCopy={copyHex}
                  onCopyAll={copyAll}
                  onToggleFavorite={toggleFavorite}
                  onOpenInfo={() => setInfoOpen(idx)}
                />
              );
            })}
          </div>
        )}

        <footer className="mt-20 mx-auto max-w-prose text-center text-xs text-neutral-500 leading-relaxed">
          {PALETTE_COUNT} palettes curated by{" "}
          <a
            href="https://github.com/Experience-Monks/nice-color-palettes"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-neutral-300 hover:decoration-neutral-900 underline-offset-2"
          >
            nice-color-palettes
          </a>
          , sourced from{" "}
          <a
            href="https://www.colourlovers.com/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-neutral-300 hover:decoration-neutral-900 underline-offset-2"
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
              className="underline decoration-neutral-300 hover:decoration-neutral-900 underline-offset-2"
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
}: {
  onRandom: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  favoritesCount: number;
  showFavoritesOnly: boolean;
  onToggleFilter: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="px-4 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
              if (typeof history !== "undefined") history.replaceState(null, "", " ");
            }}
            className="font-semibold tracking-tight text-primary text-[15px]"
          >
            Colors
          </a>
          <span className="hidden sm:inline text-xs text-neutral-500 tabular-nums">
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
            className="flex items-center justify-center size-6 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-100 transition outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="About — scroll to bottom"
            title="About"
          >
            <InfoIcon className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {favoritesCount > 0 && (
            <button
              onClick={onToggleFilter}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium transition ${
                showFavoritesOnly
                  ? "bg-primary text-white"
                  : "text-primary hover:bg-neutral-100"
              }`}
              aria-pressed={showFavoritesOnly}
              aria-label={
                showFavoritesOnly
                  ? "Show all palettes"
                  : "Show favorites only"
              }
            >
              <HeartIcon filled className="size-4" />
              <span className="tabular-nums">{favoritesCount}</span>
            </button>
          )}

          <div className="flex items-center">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex items-center justify-center size-9 rounded-md text-primary hover:bg-neutral-100 disabled:text-neutral-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
              aria-label="Previous random palette"
            >
              <UndoIcon className="size-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="inline-flex items-center justify-center size-9 rounded-md text-primary hover:bg-neutral-100 disabled:text-neutral-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
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
            Random
            <span className="hidden md:inline text-[10px] uppercase tracking-wider text-white/50 ml-1">
              R
            </span>
          </button>
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
}: CardProps & { ref?: React.Ref<HTMLAnchorElement> }) {
  const href = `#p${index + 1}`;
  return (
    <a
      ref={ref}
      id={`p${index + 1}`}
      href={href}
      onClick={(e) => {
        // let hashchange handler navigate/highlight, but prevent jump-to-anchor jank
        e.preventDefault();
        if (typeof history !== "undefined") {
          history.replaceState(null, "", href);
        }
      }}
      className={`group block rounded-lg overflow-hidden bg-white transition duration-300 ${
        highlighted ? "ring-1 ring-primary" : ""
      } ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <div className="flex h-44 sm:h-52">
        {palette.map((hex, i) => (
          <Swatch key={i} hex={hex} onCopy={onCopy} />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">
          #{(index + 1).toString().padStart(4, "0")}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenInfo();
            }}
            className="flex items-center justify-center size-7 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-100 transition outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="Show color details"
          >
            <InfoIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(index);
            }}
            className={`flex items-center justify-center size-7 rounded-sm transition outline-none focus-visible:ring-2 focus-visible:ring-black/20 hover:bg-neutral-100 ${
              isFavorite
                ? "text-primary"
                : "text-neutral-400 hover:text-primary"
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
              e.preventDefault();
              e.stopPropagation();
              onCopyAll(palette);
            }}
            className="-mr-1 flex items-center justify-center size-7 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-100 transition outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="Copy all hex codes"
            title="Select all"
          >
            <CopyIcon className="size-4" />
          </button>
        </div>
      </div>
    </a>
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
      className={`group/sw relative grow basis-0 flex items-end justify-center pb-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-inset focus-visible:ring-black/30 transition-[flex-grow] duration-300 ease-out hover:grow-[2]`}
      style={{ background: hex }}
      aria-label={`Copy ${hex.toUpperCase()}`}
    >
      <span
        className={`font-mono text-[10px] tracking-wider uppercase opacity-0 group-hover/sw:opacity-100 transition ${fg}`}
      >
        {hex.replace("#", "")}
      </span>
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center align-middle px-1.5 min-w-[1.4rem] h-5 rounded bg-neutral-100 text-[10px] font-mono text-neutral-700 mx-0.5">
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

  if (index === null || palette === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette details"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white rounded-md shadow-xl">
        <div className="sticky top-0 flex items-start justify-between px-5 pt-5 pb-3 bg-white">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Palette
            </div>
            <div className="font-mono text-base text-primary tabular-nums">
              #{(index + 1).toString().padStart(4, "0")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 flex items-center justify-center size-8 rounded-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label="Close"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {palette.map((hex, i) => (
            <ColorDetail key={i} hex={hex} onCopyValue={onCopyValue} />
          ))}
        </div>
      </div>
    </div>
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
    <div className="rounded-sm overflow-hidden">
      <div className="h-16" style={{ background: hex }} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-2 px-3 py-3">
        {rows.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => onCopyValue(hex, label, value)}
            className="group/v text-left px-2 py-1 rounded-sm hover:bg-neutral-100 transition outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label={`Copy ${label} ${value}`}
          >
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              {label}
              <CopyIcon className="size-3 opacity-0 group-hover/v:opacity-100 transition" />
            </div>
            <div className="font-mono text-xs text-neutral-700 tabular-nums">
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
