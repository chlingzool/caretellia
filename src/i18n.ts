import { ref } from "vue";

export type AppLocale = "zh" | "en";
export type LocalePreference = AppLocale | "system";

export const locale = ref<AppLocale>("zh");
export const localePreference = ref<LocalePreference>("system");

function resolveLocale(preference: LocalePreference): AppLocale {
  if (preference !== "system") return preference;
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")
    ? "zh"
    : "en";
}

function applyLocale(nextLocale: AppLocale) {
  locale.value = nextLocale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = nextLocale === "en" ? "en" : "zh-CN";
    document.title = nextLocale === "en"
      ? "Postcard Studio · Caretellia"
      : "明信片生成器 · Caretellia";
  }
}

export function setLocale(preference: LocalePreference) {
  localePreference.value = preference;
  applyLocale(resolveLocale(preference));
}

export function syncSystemLocale() {
  if (localePreference.value === "system") {
    applyLocale(resolveLocale("system"));
  }
}

export function t(chinese: string, english: string): string {
  return locale.value === "en" ? english : chinese;
}
