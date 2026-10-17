<script setup lang="ts">
import { computed, ref } from "vue";
import { DEFAULT_FONT_FAMILIES, SYSTEM_DEFAULT_FONT, useSystemFonts } from "./composables/useSystemFonts";
import type { AppSettings } from "./types/postcard";

const props = defineProps<{
  settings: AppSettings;
  exportDirectoryError?: string;
}>();

const emit = defineEmits<{
  (event: "update:settings", settings: AppSettings): void;
  (event: "browse-export-directory"): void;
}>();

const sections = [
  { id: "settings-interface", label: "界面外观" },
  { id: "settings-export", label: "导出位置" },
  { id: "settings-storage", label: "数据与隐私" },
] as const;

const activeSection = ref<(typeof sections)[number]["id"]>("settings-interface");
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
    label: family === SYSTEM_DEFAULT_FONT ? "系统默认" : family,
    value: family === SYSTEM_DEFAULT_FONT
      ? SYSTEM_DEFAULT_FONT
      : `"${family.replace(/["\\]/g, "\\$&")}", sans-serif`,
  }));
});
const currentFontIsListed = computed(() =>
  fontOptions.value.some((font) => font.value === props.settings.uiFont),
);
const fontStatus = computed(() => {
  if (isFontLoading.value) return "正在读取本机字体…";
  if (fontLoadError.value) return fontLoadError.value;
  const source = {
    native: "本机字体",
    browser: "浏览器可访问字体",
    canvas: "浏览器检测字体",
    cache: "字体缓存",
    fallback: "常用字体",
  }[fontSource.value];
  return `已读取 ${systemFontList.value.length} 种${source}`;
});

function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K], settings: AppSettings) {
  emit("update:settings", { ...settings, [key]: value });
}

function navigateToSection(id: (typeof sections)[number]["id"]) {
  activeSection.value = id;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <section class="settings-page">
    <header class="settings-heading">
      <p class="eyebrow">应用偏好</p>
      <h1>设置</h1>
      <p>调整工作区的显示方式和文件保存位置。</p>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置栏目">
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
          <h2>界面外观</h2>
          <p class="section-description">设置仅影响应用界面，不会改变信件内容中的字体。</p>

          <label class="setting-row">
            <span class="setting-copy"><strong>界面字体</strong><small>使用之前检测到的本机字体列表</small></span>
            <span class="font-select-wrap">
              <select :value="settings.uiFont" @change="updateSetting('uiFont', ($event.target as HTMLSelectElement).value, settings)">
                <option :value="SYSTEM_DEFAULT_FONT">系统默认</option>
                <option v-if="!currentFontIsListed" :value="settings.uiFont">当前字体</option>
                <option v-for="font in fontOptions.slice(1)" :key="font.value" :value="font.value">{{ font.label }}</option>
              </select>
              <span class="font-list-status" role="status" aria-live="polite">{{ fontStatus }}</span>
              <button type="button" class="font-refresh" :disabled="isFontLoading" @click="refreshSystemFonts">
                {{ isFontLoading ? "读取中…" : "刷新字体" }}
              </button>
            </span>
          </label>

          <label class="setting-row">
            <span class="setting-copy"><strong>界面字体大小</strong><small>调整整个应用界面的基准字号</small></span>
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
          <h2>导出位置</h2>
          <p class="section-description">选择导出的 HTML 文件默认保存到哪个文件夹。</p>

          <label class="setting-copy" for="export-directory"><strong>默认文件夹</strong></label>
          <div class="directory-control">
            <input
              id="export-directory"
              :value="settings.exportDirectory"
              type="text"
              placeholder="未设置时保存到应用数据目录"
              @input="updateSetting('exportDirectory', ($event.target as HTMLInputElement).value, settings)"
            />
            <button type="button" class="browse-button" @click="emit('browse-export-directory')">浏览…</button>
          </div>
          <p class="setting-hint">路径仅保存在本机。留空时使用应用默认导出目录。</p>
          <label class="setting-row export-mode-row">
            <span class="setting-copy"><strong>导出页面配色</strong><small>只改变导出页面背景和标题，不改变信件设计本身</small></span>
            <select
              :value="settings.exportColorMode"
              @change="updateSetting('exportColorMode', ($event.target as HTMLSelectElement).value as AppSettings['exportColorMode'], settings)"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </label>
          <p v-if="exportDirectoryError" class="setting-error" role="alert">{{ exportDirectoryError }}</p>
        </section>

        <section id="settings-storage" class="settings-section">
          <h2>数据与隐私</h2>
          <p class="section-description">信件与界面偏好保存在本机浏览器存储中，不会上传到网络。</p>
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
    position: static;
    display: flex;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .settings-nav button {
    white-space: nowrap;
    border-left: 0;
    border-bottom: 2px solid transparent;
  }

  .settings-nav button:hover,
  .settings-nav button.active {
    border-bottom-color: var(--accent);
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
</style>
