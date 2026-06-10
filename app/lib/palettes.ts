import palettes from "nice-color-palettes/1000.json";

export type Palette = string[];

export const PALETTES: Palette[] = palettes as Palette[];
export const PALETTE_COUNT = PALETTES.length;

export function getPalette(index: number): Palette {
  const i = ((index % PALETTE_COUNT) + PALETTE_COUNT) % PALETTE_COUNT;
  return PALETTES[i];
}

export function randomIndex(exclude?: number): number {
  if (PALETTE_COUNT < 2) return 0;
  let i = Math.floor(Math.random() * PALETTE_COUNT);
  if (exclude !== undefined && i === exclude) {
    i = (i + 1) % PALETTE_COUNT;
  }
  return i;
}

// sRGB relative luminance (WCAG)
export function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const toLin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function readableOn(hex: string): "light" | "dark" {
  return luminance(hex) > 0.45 ? "dark" : "light";
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace("#", "");
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

export function normalizeHex(input: string): string {
  let h = input.trim().replace("#", "").toLowerCase();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/.test(h)) return "#000000";
  return `#${h}`;
}

export type PaletteFilter =
  | "all"
  | "warm"
  | "cool"
  | "monochrome"
  | "contrast"
  | "light"
  | "dark";

export function matchesFilter(palette: Palette, filter: PaletteFilter): boolean {
  if (filter === "all") return true;

  const stats = palette.map((hex) => {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const lum = luminance(hex);
    return { ...hsl, lum };
  });

  switch (filter) {
    case "warm":
      return stats.filter((s) => s.h <= 60 || s.h >= 300).length >= 3;
    case "cool":
      return stats.filter((s) => s.h > 120 && s.h < 280).length >= 3;
    case "monochrome": {
      const activeColors = stats.filter((s) => s.s > 10 && s.l > 10 && s.l < 95);
      if (activeColors.length <= 1) return true;
      const hues = activeColors.map((s) => s.h).sort((a, b) => a - b);
      let maxGap = 0;
      for (let i = 0; i < hues.length; i++) {
        const gap =
          i === hues.length - 1
            ? 360 - hues[i] + hues[0]
            : hues[i + 1] - hues[i];
        maxGap = Math.max(maxGap, gap);
      }
      return 360 - maxGap < 60;
    }
    case "contrast": {
      const lums = stats.map((s) => s.lum);
      return Math.max(...lums) - Math.min(...lums) > 0.7;
    }
    case "light": {
      const avgLum = stats.reduce((acc, s) => acc + s.lum, 0) / stats.length;
      return avgLum > 0.7;
    }
    case "dark": {
      const avgLum = stats.reduce((acc, s) => acc + s.lum, 0) / stats.length;
      return avgLum < 0.3;
    }
    default:
      return true;
  }
}

export function matchesSearch(palette: Palette, index: number, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // 1. Index match (e.g. "42" or "#42")
  const displayIdx = (index + 1).toString();
  if (q === displayIdx || q === `#${displayIdx}`) return true;

  // 2. Hex match (partial)
  if (palette.some((hex) => hex.toLowerCase().includes(q.replace("#", "")))) {
    return true;
  }

  // 3. Simple color name match via Hue
  const colorNames: Record<string, [number, number]> = {
    red: [0, 20],
    orange: [20, 45],
    yellow: [45, 70],
    green: [70, 160],
    cyan: [160, 190],
    blue: [190, 260],
    purple: [260, 300],
    pink: [300, 340],
    // red wraps around
  };

  if (colorNames[q]) {
    const [min, max] = colorNames[q];
    return palette.some((hex) => {
      const { r, g, b } = hexToRgb(hex);
      const { h, s, l } = rgbToHsl(r, g, b);
      // Ignore very desaturated colors for name matching
      if (s < 15 || l < 10 || l > 95) return false;
      if (q === "red") return h > 340 || h <= 20;
      return h > min && h <= max;
    });
  }

  return false;
}
