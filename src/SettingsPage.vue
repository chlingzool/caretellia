<script setup lang="ts">
import { computed, ref } from "vue";
import { DEFAULT_FONT_FAMILIES, SYSTEM_DEFAULT_FONT, useSystemFonts } from "./composables/useSystemFonts";
import { t } from "./i18n";
import type { AppSettings } from "./types/postcard";

const props = defineProps<{
  settings: AppSettings;
  exportDirectoryError?: string;
}>();

const emit = defineEmits<{
  (event: "update:settings", settings: AppSettings): void;
  (event: "browse-export-directory"): void;
}>();

const sections = computed(() => [
  { id: "settings-interface", label: t("界面外观", "Appearance") },
  { id: "settings-export", label: t("导出位置", "Export location") },
  { id: "settings-storage", label: t("数据与隐私", "Data & privacy") },
] as const);

type SettingsSectionId = "settings-interface" | "settings-export" | "settings-storage";
const activeSection = ref<SettingsSectionId>("settings-interface");
const {
  systemFontList,
  isLoading: isFontLoading,
  fontSource,
  fontLoadError,
  refreshSystemFonts,
} = useSystemFonts();
const fontOptions = computed(() => {
  const families = [...new Set([...DEFAULT_FONT_FAMILIES, ...systemFontList.value])]
    .filter((family) => family !== SYSTEM_DEFAULT_FONT)
    .sort((a, b) => a.localeCompare(b));
  return [SYSTEM_DEFAULT_FONT, ...families].map((family) => ({
    label: family === SYSTEM_DEFAULT_FONT ? t("系统默认", "System default") : family,
    value: family === SYSTEM_DEFAULT_FONT
      ? SYSTEM_DEFAULT_FONT
      : `"${family.replace(/["\\]/g, "\\$&")}", sans-serif`,
  }));
});
const currentFontIsListed = computed(() =>
  fontOptions.value.some((font) => font.value === props.settings.uiFont),
);
const fontStatus = computed(() => {
  if (isFontLoading.value) return t("正在读取本机字体…", "Reading local fonts…");
  if (fontLoadError.value) return fontLoadError.value;
  const source = {
    native: t("本机字体", "local fonts"),
    browser: t("浏览器可访问字体", "browser-accessible fonts"),
    canvas: t("浏览器检测字体", "fonts detected by the browser"),
    cache: t("字体缓存", "cached fonts"),
    fallback: t("常用字体", "common fonts"),
  }[fontSource.value];
  return t(`已读取 ${systemFontList.value.length} 种${source}`, `Found ${systemFontList.value.length} ${source}`);
});

function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K], settings: AppSettings) {
  emit("update:settings", { ...settings, [key]: value });
}

function navigateToSection(id: SettingsSectionId) {
  activeSection.value = id;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <section class="settings-page">
    <header class="settings-heading">
      <p class="eyebrow">{{ t("应用偏好", "Preferences") }}</p>
      <h1>{{ t("设置", "Settings") }}</h1>
      <p>{{ t("调整工作区的显示方式和文件保存位置。", "Customize the workspace and where files are saved.") }}</p>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" :aria-label="t('设置栏目', 'Settings sections')">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="navigateToSection(section.id)"
        >{{ section.label }}</button>
      </nav>

      <div class="settings-content">
        <section id="settings-interface" class="settings-section">
          <h2>{{ t("界面外观", "Appearance") }}</h2>
          <p class="section-description">{{ t("设置仅影响应用界面，不会改变信件内容中的字体。", "These settings affect the app interface only, not the fonts in your letters.") }}</p>

          <label class="setting-row">
            <span class="setting-copy"><strong>{{ t("显示语言", "Display language") }}</strong><small>{{ t("选择应用界面语言", "Choose the language used throughout the app") }}</small></span>
            <select :value="settings.locale" @change="updateSetting('locale', ($event.target as HTMLSelectElement).value as AppSettings['locale'], settings)">
              <option value="system">{{ t("跟随系统", "Follow system") }}</option>
              <option value="zh">简体中文</option>
              <option value="en">English</option>
            </select>
          </label>

          <label class="setting-row">
            <span class="setting-copy"><strong>{{ t("界面字体", "Interface font") }}</strong><small>{{ t("使用之前检测到的本机字体列表", "Choose from fonts detected on this device") }}</small></span>
            <span class="font-select-wrap">
              <select :value="settings.uiFont" @change="updateSetting('uiFont', ($event.target as HTMLSelectElement).value, settings)">
                <option :value="SYSTEM_DEFAULT_FONT">{{ t("系统默认", "System default") }}</option>
                <option v-if="!currentFontIsListed" :value="settings.uiFont">{{ t("当前字体", "Current font") }}</option>
                <option v-for="font in fontOptions.slice(1)" :key="font.value" :value="font.value">{{ font.label }}</option>
              </select>
              <span class="font-list-status" role="status" aria-live="polite">{{ fontStatus }}</span>
              <button type="button" class="font-refresh" :disabled="isFontLoading" @click="refreshSystemFonts">
                {{ isFontLoading ? t("读取中…", "Loading…") : t("刷新字体", "Refresh fonts") }}
              </button>
            </span>
          </label>

          <label class="setting-row">
            <span class="setting-copy"><strong>{{ t("界面字体大小", "Interface font size") }}</strong><small>{{ t("调整整个应用界面的基准字号", "Adjust the base text size across the app") }}</small></span>
            <span class="font-size-control">
              <input
                type="range"
                min="12"
                max="20"
                step="1"
                :value="props.settings.uiFontSize"
                @input="updateSetting('uiFontSize', Number(($event.target as HTMLInputElement).value), props.settings)"
              />
              <output>{{ props.settings.uiFontSize }} px</output>
            </span>
          </label>
        </section>

        <section id="settings-export" class="settings-section">
          <h2>{{ t("导出位置", "Export location") }}</h2>
          <p class="section-description">{{ t("选择导出的 HTML 文件默认保存到哪个文件夹。", "Choose the default folder for exported HTML files.") }}</p>

          <label class="setting-copy" for="export-directory"><strong>{{ t("默认文件夹", "Default folder") }}</strong></label>
          <div class="directory-control">
            <input
              id="export-directory"
              :value="settings.exportDirectory"
              type="text"
              :placeholder="t('未设置时保存到应用数据目录', 'Uses the app data folder when not set')"
              @input="updateSetting('exportDirectory', ($event.target as HTMLInputElement).value, settings)"
            />
            <button type="button" class="browse-button" @click="emit('browse-export-directory')">{{ t("浏览…", "Browse…") }}</button>
          </div>
          <p class="setting-hint">{{ t("路径仅保存在本机。留空时使用应用默认导出目录。", "The path is stored locally. Leave it blank to use the default export folder.") }}</p>
          <label class="setting-row export-mode-row">
            <span class="setting-copy"><strong>{{ t("导出页面配色", "Export page theme") }}</strong><small>{{ t("只改变导出页面背景和标题，不改变信件设计本身", "Changes the export page background and title only, not the letter design") }}</small></span>
            <select
              :value="settings.exportColorMode"
              @change="updateSetting('exportColorMode', ($event.target as HTMLSelectElement).value as AppSettings['exportColorMode'], settings)"
            >
              <option value="light">{{ t("浅色", "Light") }}</option>
              <option value="dark">{{ t("深色", "Dark") }}</option>
              <option value="system">{{ t("跟随系统", "System") }}</option>
            </select>
          </label>
          <p v-if="exportDirectoryError" class="setting-error" role="alert">{{ exportDirectoryError }}</p>
        </section>

        <section id="settings-storage" class="settings-section">
          <h2>{{ t("数据与隐私", "Data & privacy") }}</h2>
          <p class="section-description">{{ t("信件与界面偏好保存在本机浏览器存储中，不会上传到网络。", "Letters and preferences are stored in this browser on your device and are never uploaded.") }}</p>
          <label class="setting-row">
            <span class="setting-copy"><strong>{{ t("最近查看保留数量", "Recently viewed limit") }}</strong><small>{{ t("超出数量时自动移除最早的本地文件记录", "Oldest local file entries are removed when the limit is exceeded") }}</small></span>
            <select
              :value="settings.recentViewedLimit"
              @change="updateSetting('recentViewedLimit', Number(($event.target as HTMLSelectElement).value), settings)"
            >
              <option :value="5">{{ t("5 封", "5 letters") }}</option>
              <option :value="10">{{ t("10 封", "10 letters") }}</option>
              <option :value="20">{{ t("20 封", "20 letters") }}</option>
              <option :value="30">{{ t("30 封", "30 letters") }}</option>
            </select>
          </label>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  color: var(--text);
}

.settings-heading {
  margin-bottom: 22px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 0.8571em;
  font-weight: 650;
}

h1 {
  margin: 0;
  font-size: 2.1429em;
  font-weight: 600;
}

.settings-heading > p:last-child,
.section-description,
.setting-hint {
  color: var(--muted);
  font-size: 0.9286em;
}

.settings-heading > p:last-child {
  margin: 8px 0 0;
}

.settings-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.settings-nav {
  position: sticky;
  top: 18px;
  display: grid;
  gap: 3px;
  padding: 6px 0;
  border-right: 1px solid var(--border);
}

.settings-nav button {
  padding: 10px 12px;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  text-align: left;
  font: inherit;
  font-size: 0.9286em;
  cursor: pointer;
}

.settings-nav button:hover,
.settings-nav button.active {
  border-left-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}

.settings-content {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.settings-section {
  scroll-margin-top: 20px;
  padding: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.settings-section h2 {
  margin: 0;
  font-size: 1.0714em;
}

.section-description {
  margin: 6px 0 16px;
  line-height: 1.55;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 0;
  border-top: 1px solid var(--border);
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.setting-copy strong {
  font-size: 0.9286em;
  font-weight: 600;
}

.setting-copy small {
  color: var(--muted);
  font-size: 0.7857em;
}

.setting-row select,
.directory-control input {
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.9286em;
}

.font-select-wrap {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto;
  gap: 6px 8px;
  width: min(380px, 55%);
}

.font-select-wrap select {
  grid-column: 1 / -1;
  width: 100%;
}

.font-list-status {
  align-self: center;
  color: var(--muted);
  font-size: 0.7857em;
}

.font-refresh {
  justify-self: end;
  padding: 4px 8px;
  border: 1px solid var(--border-strong);
  background: var(--surface-alt);
  color: var(--text);
  font: inherit;
  font-size: 0.7857em;
  cursor: pointer;
}

.font-refresh:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.font-refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}

.export-mode-row {
  margin-top: 12px;
  border-top: 1px solid var(--border);
}

.setting-row select {
  width: min(280px, 50%);
}

.font-size-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.font-size-control input {
  accent-color: var(--accent);
}

.font-size-control output {
  min-width: 48px;
  color: var(--muted);
  font-size: 0.8571em;
}

.directory-control {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.directory-control input {
  flex: 1;
  min-width: 0;
}

.browse-button {
  min-height: 36px;
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  background: var(--surface-alt);
  color: var(--text);
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
}

.browse-button:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

 .setting-hint {
  margin: 8px 0 0;
  font-size: 0.7857em;
}

.setting-error {
  margin: 8px 0 0;
  color: #c84840;
  font-size: 0.8571em;
}

@media (max-width: 700px) {
  .settings-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .settings-nav {
    position: sticky;
    top: calc(52px + env(safe-area-inset-top, 0px));
    z-index: 10;
    display: flex;
    overflow-x: auto;
    background: var(--surface);
    border-right: 0;
    border-bottom: 1px solid var(--border);
    box-shadow: 0 5px 12px rgb(20 30 40 / 7%);
  }

  .settings-nav button {
    flex: 0 0 auto;
    min-height: 44px;
    white-space: nowrap;
    border-left: 0;
    border-bottom: 2px solid transparent;
  }

  .settings-nav button:hover,
  .settings-nav button.active {
    border-bottom-color: var(--accent);
  }

  .settings-section {
    scroll-margin-top: 66px;
  }

  .setting-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .setting-row select {
    width: 100%;
  }

  .font-select-wrap {
    width: 100%;
  }
}

@media (hover: none) and (pointer: coarse) {
  .setting-row select,
  .directory-control input,
  .browse-button,
  .font-refresh {
    min-height: 44px;
    font-size: 16px;
  }

  .settings-section {
    scroll-margin-top: calc(108px + env(safe-area-inset-top, 0px));
  }
}
</style>
