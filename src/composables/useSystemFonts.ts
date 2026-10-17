import { onMounted, ref } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";

interface FontInfo {
  family: string;
}

interface LocalFontWindow extends Window {
  queryLocalFonts?: () => Promise<Array<{ family: string }>>;
}

interface FontCache {
  version: 2;
  cachedAt: number;
  fonts: string[];
}

const CACHE_KEY = "caretellia-system-fonts-v2";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_FONT_FAMILIES = ["Arial", "Georgia", "Microsoft YaHei", "Times New Roman"];
export const SYSTEM_DEFAULT_FONT = "system-ui";
const FONT_CANDIDATES = [
  "Arial", "Arial Black", "Calibri", "Cambria", "Consolas", "Courier New",
  "Segoe UI", "Tahoma", "Verdana", "Georgia", "Garamond", "Times New Roman",
  "Microsoft YaHei", "Microsoft JhengHei", "SimSun", "SimHei", "KaiTi",
  "FangSong", "PingFang SC", "Songti SC", "Hiragino Sans GB", "Helvetica",
  "Helvetica Neue", "Menlo", "Monaco", "Avenir", "Noto Sans", "Noto Serif",
  "Noto Sans CJK SC", "Noto Serif CJK SC", "DejaVu Sans", "DejaVu Serif",
  "Liberation Sans", "Liberation Serif", "Ubuntu", "WenQuanYi Micro Hei",
  "Source Han Sans SC", "Source Han Serif SC",
];
const TEST_STRINGS = [
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  "天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏",
];
const GENERIC_FONTS = ["monospace", "sans-serif", "serif"];

const systemFontList = ref<string[]>([...DEFAULT_FONT_FAMILIES]);
const isLoading = ref(true);
const fontSource = ref<"native" | "browser" | "canvas" | "cache" | "fallback">("fallback");
const fontLoadError = ref<string | null>(null);
let hasLoaded = false;
let loadingPromise: Promise<void> | null = null;

function sortUniqueFonts(fonts: string[]): string[] {
  return [...new Set(fonts.map((font) => font.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function normalizeNativeFonts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return sortUniqueFonts(value.flatMap((font: unknown) => {
    if (typeof font === "string") return [font];
    if (font && typeof font === "object" && "family" in font &&
      typeof font.family === "string") {
      return [font.family];
    }
    return [];
  }));
}

function isFontCache(value: unknown): value is FontCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Record<string, unknown>;
  if (cache.version !== 2 || typeof cache.cachedAt !== "number" ||
    !Array.isArray(cache.fonts) ||
    !cache.fonts.every((font) => typeof font === "string")) {
    return false;
  }
  const age = Date.now() - cache.cachedAt;
  return age >= 0 && age < CACHE_MAX_AGE_MS;
}

function readCachedFonts(): string[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];

    const parsed: unknown = JSON.parse(cached);
    const fonts = isFontCache(parsed) ? sortUniqueFonts(parsed.fonts) : [];
    if (fonts.length === 0) {
      localStorage.removeItem(CACHE_KEY);
      return [];
    }
    return fonts;
  } catch (error) {
    console.warn("Unable to read cached system fonts:", error);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (removeError) {
      console.warn("Unable to clear invalid system font cache:", removeError);
    }
    return [];
  }
}

function cacheFonts(fonts: string[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 2,
      cachedAt: Date.now(),
      fonts,
    }));
  } catch (error) {
    console.warn("Unable to cache system fonts:", error);
  }
}

async function detectSystemFontsBrowser(): Promise<string[]> {
  const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts;
  if (!queryLocalFonts) return [];
  const fonts = await queryLocalFonts();
  return sortUniqueFonts(fonts.map(({ family }) => family));
}

function detectSystemFontsCanvas(): string[] {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return [];

  const baselineWidths = new Map<string, number[]>();
  for (const sample of TEST_STRINGS) {
    baselineWidths.set(sample, GENERIC_FONTS.map((family) => {
      context.font = `16px ${family}`;
      return context.measureText(sample).width;
    }));
  }

  return sortUniqueFonts(FONT_CANDIDATES.filter((family) => {
    const escapedFamily = family.replace(/["\\]/g, "\\$&");
    return TEST_STRINGS.some((sample) => {
      context.font = `16px "${escapedFamily}", sans-serif`;
      const width = context.measureText(sample).width;
      return !baselineWidths.get(sample)?.some((baseline) => Math.abs(baseline - width) < 0.01);
    });
  }));
}

async function loadSystemFonts(forceRefresh = false): Promise<void> {
  if (hasLoaded && !forceRefresh) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    isLoading.value = true;
    fontLoadError.value = null;
    try {
      const cachedFonts = forceRefresh ? [] : readCachedFonts();
      if (cachedFonts.length > 0) {
        systemFontList.value = cachedFonts;
        fontSource.value = "cache";
        return;
      }

      let nativeFonts: string[] = [];
      if (isTauri()) {
        try {
          nativeFonts = normalizeNativeFonts(
            await invoke<FontInfo[]>("get_system_fonts"),
          );
          if (nativeFonts.length === 0) {
            throw new Error("The system font command returned no usable font names.");
          }
        } catch (error) {
          console.warn("Native system font detection failed; trying browser detection:", error);
        }
      }

      if (nativeFonts.length > 0) {
        systemFontList.value = nativeFonts;
        fontSource.value = "native";
        cacheFonts(nativeFonts);
      } else {
        let detectedFonts: string[] = [];
        let detectedSource: "browser" | "canvas" = "browser";
        try {
          detectedFonts = await detectSystemFontsBrowser();
        } catch (error) {
          console.warn("Browser local font detection failed; trying canvas detection:", error);
        }
        if (detectedFonts.length === 0) {
          detectedSource = "canvas";
          try {
            detectedFonts = detectSystemFontsCanvas();
          } catch (error) {
            console.error("Canvas system font detection failed:", error);
            fontLoadError.value = "字体检测失败，已切换到常用字体。";
          }
        }
        if (detectedFonts.length === 0) {
          fontLoadError.value ??= "未能检测到可用字体，当前显示常用字体。";
        }
        systemFontList.value = detectedFonts.length > 0
          ? detectedFonts
          : [...DEFAULT_FONT_FAMILIES];
        fontSource.value = detectedFonts.length > 0 ? detectedSource : "fallback";
        if (detectedFonts.length > 0) cacheFonts(detectedFonts);
      }
    } catch (error) {
      console.error("System font loading failed:", error);
      systemFontList.value = [...DEFAULT_FONT_FAMILIES];
      fontSource.value = "fallback";
      fontLoadError.value = "字体读取失败，已切换到常用字体。";
    } finally {
      hasLoaded = true;
      isLoading.value = false;
    }
  })();

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function useSystemFonts() {
  onMounted(() => {
    void loadSystemFonts();
  });

  return {
    systemFontList,
    isLoading,
    fontSource,
    fontLoadError,
    refreshSystemFonts: () => loadSystemFonts(true),
  };
}
