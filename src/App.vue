<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import postcardEditor from "./postcard-editor.vue";
import TemplateGallery from "./TemplateGallery.vue";
import SettingsPage from "./SettingsPage.vue";
import ThanksMenu from "./ThanksMenu.vue";
import { locale, setLocale, syncSystemLocale, t } from "./i18n";
import type { AppSettings, LetterTemplate } from "./types/postcard";

type Screen =
  | { kind: "home" }
  | { kind: "editor"; entry: "new" | "history" | "template"; sessionId: string; cardId?: string; template?: LetterTemplate }
  | { kind: "history" }
  | { kind: "templates" }
  | { kind: "settings" };

const screens = ref<Screen[]>([{ kind: "home" }]);
const historyVersion = ref(0);
const historyError = ref("");
const historyDetailsId = ref<string | null>(null);
const settingsError = ref("");
const exportDirectoryError = ref("");
const showThanks = ref(false);
const thanksButton = ref<HTMLButtonElement | null>(null);
const settings: AppSettings = reactive(readSettings());
setLocale(settings.locale);
const theme = ref<"light" | "dark">(
  localStorage.getItem("caretellia-theme") === "dark" ||
    (localStorage.getItem("caretellia-theme") !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "dark"
    : "light",
);
watch(theme, (nextTheme) => {
  document.documentElement.dataset.theme = nextTheme;
}, { immediate: true });

const currentScreen = computed(() => screens.value[screens.value.length - 1]);

const historyCards = computed(() => {
  historyVersion.value;
  try {
    const raw = localStorage.getItem("caretellia-postcards");
    if (!raw) return [];
    const cards = JSON.parse(raw);
    return Array.isArray(cards) ? cards : [];
  } catch {
    return [];
  }
});

const savedCount = computed(() => historyCards.value.length);

const showExport = ref(false);
const exportData = ref<{
  title: string;
  message: string;
  from: string;
  to: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
} | null>(null);

function refreshHistory() {
  historyVersion.value += 1;
}

function readSettings(): AppSettings {
  const defaults: AppSettings = {
    uiFont: "'Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif",
    uiFontSize: 14,
    exportDirectory: "",
    exportColorMode: "system",
    locale: "system",
  };
  try {
    const saved = localStorage.getItem("caretellia-settings");
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    return {
      uiFont: typeof parsed.uiFont === "string" ? parsed.uiFont : defaults.uiFont,
      uiFontSize: Number.isFinite(parsed.uiFontSize) ? Math.min(20, Math.max(12, parsed.uiFontSize)) : defaults.uiFontSize,
      exportDirectory: typeof parsed.exportDirectory === "string" ? parsed.exportDirectory : defaults.exportDirectory,
      exportColorMode: parsed.exportColorMode === "light" || parsed.exportColorMode === "dark"
        ? parsed.exportColorMode
        : "system",
      locale: parsed.locale === "en" || parsed.locale === "zh" ? parsed.locale : "system",
    };
  } catch (error) {
    console.error("Unable to load app settings:", error);
    return defaults;
  }
}

function navigate(screen: Screen) {
  screens.value = [...screens.value, screen];
}

function goBack() {
  if (screens.value.length > 1) {
    screens.value = screens.value.slice(0, -1);
  }
}

function openNewEditor() {
  navigate({ kind: "editor", entry: "new", sessionId: crypto.randomUUID() });
}

function goHome() {
  historyDetailsId.value = null;
  screens.value = [{ kind: "home" }];
}

function openHistoryScreen() {
  navigate({ kind: "history" });
}

function openTemplateGallery() {
  navigate({ kind: "templates" });
}

function openSettings() {
  navigate({ kind: "settings" });
}

function closeThanks() {
  showThanks.value = false;
  void nextTick(() => thanksButton.value?.focus());
}

function openTemplateEditor(template: LetterTemplate) {
  navigate({ kind: "editor", entry: "template", sessionId: crypto.randomUUID(), template });
}

function toggleHistoryDetails(cardId: string) {
  historyDetailsId.value = historyDetailsId.value === cardId ? null : cardId;
}

function addressName(value: string | undefined, fallback: string) {
  return value?.replace(/^(来自：|From:\s*|致：|To:\s*)/, "").trim() || fallback;
}

function openHistoryCard(cardId: string) {
  navigate({ kind: "editor", entry: "history", sessionId: crypto.randomUUID(), cardId });
}

function deleteHistoryCard(cardId: string) {
  if (!window.confirm(t("确定删除这封信件吗？此操作无法撤销。", "Delete this letter? This action cannot be undone."))) return;

  try {
    const raw = localStorage.getItem("caretellia-postcards");
    const cards = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cards)) {
      throw new Error("历史信件数据格式无效");
    }
    const remainingCards = cards.filter((card) => card.id !== cardId);
    localStorage.setItem("caretellia-postcards", JSON.stringify(remainingCards));
    historyError.value = "";
    window.dispatchEvent(new CustomEvent("caretellia-history-changed"));
  } catch (error) {
    console.error("Unable to delete saved letter:", error);
    historyError.value = t("删除失败，请检查本机存储空间后重试。", "Could not delete the letter. Check local storage and try again.");
  }
}

function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  localStorage.setItem("caretellia-theme", theme.value);
}

function updateSettings(next: AppSettings) {
  Object.assign(settings, next);
  setLocale(next.locale);
  settingsError.value = "";
  try {
    localStorage.setItem("caretellia-settings", JSON.stringify(settings));
  } catch (error) {
    console.error("Unable to save app settings:", error);
    settingsError.value = t("设置未能保存到本机，请检查存储空间。", "Settings could not be saved locally. Check available storage.");
  }
}

async function chooseExportDirectory() {
  exportDirectoryError.value = "";
  try {
    const selected = await open({ directory: true, multiple: false, title: t("选择导出文件夹", "Choose export folder") });
    if (typeof selected === "string") {
      updateSettings({ ...settings, exportDirectory: selected });
    }
  } catch (error) {
    console.error("Unable to select export directory:", error);
    exportDirectoryError.value = t("无法打开文件夹选择器；可以在路径框中手动输入目录。", "Could not open the folder picker. You can enter a path manually.");
  }
}

function handleExport(data: any) {
  exportData.value = data;
  showExport.value = true;
}

onMounted(() => {
  refreshHistory();
  const handleStorageUpdate = () => refreshHistory();
  window.addEventListener("languagechange", syncSystemLocale);
  window.addEventListener("storage", handleStorageUpdate);
  window.addEventListener("caretellia-history-changed", handleStorageUpdate);
  onBeforeUnmount(() => {
    window.removeEventListener("languagechange", syncSystemLocale);
    window.removeEventListener("storage", handleStorageUpdate);
    window.removeEventListener("caretellia-history-changed", handleStorageUpdate);
  });
});
</script>

<template>
  <div class="app-shell" :data-theme="theme" :style="{ '--ui-font-family': settings.uiFont, '--ui-font-size': `${settings.uiFontSize}px` }">
    <header class="app-bar">
      <button class="brand" type="button" :aria-label="t('回到首页', 'Go to home')" @click="goHome">
        <span class="brand-mark" aria-hidden="true">✉</span>
        <span class="brand-name">Caretellia</span>
        <span class="brand-divider"></span>
        <span class="brand-product">{{ t("明信片工作室", "Postcard Studio") }}</span>
      </button>
      <div class="app-actions">
      <button ref="thanksButton" class="thanks-toggle" type="button" :aria-expanded="showThanks" aria-haspopup="dialog" @click="showThanks = true">
        <span aria-hidden="true">♥</span>
        <span>{{ t("感谢", "Thanks") }}</span>
      </button>
      <button class="theme-toggle" type="button" :aria-label="t('打开设置', 'Open settings')" @click="openSettings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></svg>
        <span>{{ t("设置", "Settings") }}</span>
      </button>
      <button class="theme-toggle" type="button" :aria-label="theme === 'light' ? t('切换到深色模式', 'Switch to dark mode') : t('切换到浅色模式', 'Switch to light mode')" @click="toggleTheme">
        <svg v-if="theme === 'light'" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
        <span>{{ theme === 'light' ? t("深色模式", "Dark mode") : t("浅色模式", "Light mode") }}</span>
      </button>
      </div>
    </header>

    <main class="container">
      <template v-if="currentScreen.kind === 'home'">
        <section class="welcome">
          <div>
            <p class="eyebrow">{{ t("你的私人信笺工作区", "Your personal letter workspace") }}</p>
            <h1 class="page-title">{{ t("把心意，写成一封信。", "Make your message a letter.") }}</h1>
            <p class="page-subtitle">{{ t("设计一张明信片或一封信，让重要的话值得被珍藏。", "Design a postcard or letter to make your words worth keeping.") }}</p>
          </div>
          <div class="welcome-stat">
            <span class="stat-number">{{ savedCount }}</span>
            <span class="stat-label">{{ t("封存的信件", "Saved letters") }}</span>
          </div>
        </section>

        <section class="home-shell" :aria-label="t('工作区入口', 'Workspace shortcuts')">
          <button class="home-card primary" type="button" @click="openNewEditor">
            <span class="card-icon compose-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4M13 20h7" /></svg>
            </span>
            <span class="home-card-copy">
              <span class="home-card-label">{{ t("从一张白纸开始", "Start with a blank page") }}</span>
              <strong>{{ t("新建信件", "New letter") }}</strong>
              <small>{{ t("挑选信封、明信片或单面信纸，开始写下你的心意。", "Choose an envelope, postcard, or letter sheet and start writing.") }}</small>
            </span>
            <span class="card-arrow" aria-hidden="true">→</span>
          </button>

          <button class="home-card" type="button" @click="openTemplateGallery">
            <span class="card-icon template-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M8 4v16M8 9h13M8 15h13" /></svg>
            </span>
            <span class="home-card-copy">
              <span class="home-card-label">{{ t("选择版式与文案", "Choose a layout and message") }}</span>
              <strong>{{ t("从模板开始", "Browse templates") }}</strong>
              <small>{{ t("像挑选幻灯片一样预览并选择单独模板。", "Preview and choose a design, just like picking a presentation theme.") }}</small>
            </span>
            <span class="card-arrow" aria-hidden="true">→</span>
          </button>

          <button class="home-card" type="button" @click="openHistoryScreen">
            <span class="card-icon archive-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" /></svg>
            </span>
            <span class="home-card-copy">
              <span class="home-card-label">{{ t("回到珍藏的时刻", "Return to your saved moments") }}</span>
              <strong>{{ t("历史信件", "Letter history") }}</strong>
              <small>{{ t(`${savedCount} 封已保存，可随时继续编辑。`, `${savedCount} saved. Continue editing any time.`) }}</small>
            </span>
            <span class="card-arrow" aria-hidden="true">→</span>
          </button>
        </section>

        <p class="home-footnote"><span class="status-dot"></span> {{ t("所有内容只保存在这台设备上", "Everything is stored on this device only") }}</p>
      </template>

      <template v-else-if="currentScreen.kind === 'history'">
        <div class="command-bar">
          <button class="toolbar-btn" type="button" @click="goHome"><span aria-hidden="true">⌂</span> {{ t("首页", "Home") }}</button>
          <button class="toolbar-btn back-btn" type="button" @click="goBack"><span aria-hidden="true">←</span> {{ t("返回", "Back") }}</button>
          <span class="command-divider"></span>
          <span class="command-context">{{ t("历史信件", "Letter history") }}</span>
          <div class="toolbar-segment right">
            <button class="toolbar-btn primary-command" type="button" @click="openNewEditor"><span aria-hidden="true">＋</span> {{ t("新建信件", "New letter") }}</button>
          </div>
        </div>

        <section class="page-heading">
          <div>
            <p class="eyebrow">{{ t("你的收藏", "Your collection") }}</p>
            <h1 class="page-title">{{ t("历史信件", "Letter history") }}</h1>
            <p class="page-subtitle">{{ t("每一封都保存于本机，可以随时回来继续编辑。", "Every letter is saved locally and can be edited again at any time.") }}</p>
          </div>
          <span class="count-badge">{{ t(`${savedCount} 封`, `${savedCount} letters`) }}</span>
        </section>

        <p v-if="historyError" class="history-error" role="alert">{{ historyError }}</p>
        <section class="panel-shell">
          <div v-if="historyCards.length === 0" class="empty-state">
            <span class="empty-icon" aria-hidden="true">✉</span>
            <strong>{{ t("这里还没有信件", "No letters yet") }}</strong>
            <span>{{ t("创建并保存第一封信，它会出现在这里。", "Create and save your first letter to see it here.") }}</span>
            <button class="toolbar-btn primary-command" type="button" @click="openNewEditor">{{ t("新建信件", "New letter") }}</button>
          </div>

          <article v-for="card in historyCards" :key="card.id" class="history-entry">
          <div
            class="history-item"
            role="button"
            tabindex="0"
            :aria-expanded="historyDetailsId === card.id"
            @click="toggleHistoryDetails(card.id)"
            @keydown.enter.prevent="toggleHistoryDetails(card.id)"
            @keydown.space.prevent="toggleHistoryDetails(card.id)"
          >
            <span class="history-type-icon" aria-hidden="true">{{ card.type === 'envelope' ? '✉' : card.type === 'letter' ? '▤' : '▧' }}</span>
            <span class="history-info history-open-button">
              <span class="history-title">{{ card.title || t('未命名', 'Untitled') }}<span class="type-tag">{{ card.type === 'envelope' ? t('信封', 'Envelope') : card.type === 'letter' ? t('信纸', 'Letter sheet') : t('明信片', 'Postcard') }}</span></span>
              <span class="history-address">{{ t("来自：", "From: ") }}{{ addressName(card.from, t("我", "Me")) }} <span aria-hidden="true">→</span> {{ t("致：", "To: ") }}{{ addressName(card.to, t("你", "You")) }}</span>
              <span v-if="card.note" class="history-note">{{ card.note }}</span>
              <span class="history-date">{{ new Date(card.createdAt || Date.now()).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') }}</span>
            </span>
            <div class="history-actions">
              <button class="delete-button" type="button" :aria-label="t(`删除${card.title || '未命名信件'}`, `Delete ${card.title || 'untitled letter'}`)" @click.stop="deleteHistoryCard(card.id)">{{ t("删除", "Delete") }}</button>
              <button class="history-open" type="button" @click.stop="openHistoryCard(card.id)">{{ t("打开", "Open") }} <span aria-hidden="true">→</span></button>
            </div>
          </div>
          <div v-if="historyDetailsId === card.id" class="history-details" @click.stop>
            <p><strong>{{ t("标题：", "Title: ") }}</strong>{{ card.title || t("未命名", "Untitled") }}</p>
            <p><strong>{{ t("类型：", "Type: ") }}</strong>{{ card.type === 'envelope' ? t('信封', 'Envelope') : card.type === 'letter' ? t('信纸', 'Letter sheet') : t('明信片', 'Postcard') }}</p>
            <p><strong>{{ t("寄件人：", "From: ") }}</strong>{{ addressName(card.from, t("我", "Me")) }}　<strong>{{ t("收件人：", "To: ") }}</strong>{{ addressName(card.to, t("你", "You")) }}</p>
            <p v-if="card.note"><strong>{{ t("备注：", "Note: ") }}</strong>{{ card.note }}</p>
            <p v-if="card.message"><strong>{{ t("正文：", "Message: ") }}</strong><span class="detail-copy">{{ card.message }}</span></p>
            <p v-if="card.type === 'postcard' && card.backCaption"><strong>{{ t("背面文字：", "Back text: ") }}</strong><span class="detail-copy">{{ card.backCaption }}</span></p>
            <p v-if="card.type === 'postcard' && card.caption"><strong>{{ t("正面文字：", "Front text: ") }}</strong>{{ card.caption }}</p>
          </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentScreen.kind === 'templates'">
        <div class="command-bar">
          <button class="toolbar-btn" type="button" @click="goHome"><span aria-hidden="true">⌂</span> {{ t("首页", "Home") }}</button>
          <button class="toolbar-btn back-btn" type="button" @click="goBack"><span aria-hidden="true">←</span> {{ t("返回", "Back") }}</button>
          <span class="command-divider"></span>
          <span class="command-context">{{ t("模板库", "Templates") }}</span>
        </div>
        <TemplateGallery @select="openTemplateEditor" />
      </template>

      <template v-else-if="currentScreen.kind === 'settings'">
        <div class="command-bar">
          <button class="toolbar-btn" type="button" @click="goHome"><span aria-hidden="true">⌂</span> {{ t("首页", "Home") }}</button>
          <button class="toolbar-btn back-btn" type="button" @click="goBack"><span aria-hidden="true">←</span> {{ t("返回", "Back") }}</button>
          <span class="command-divider"></span>
          <span class="command-context">{{ t("设置", "Settings") }}</span>
        </div>
        <SettingsPage
          :settings="settings"
          :export-directory-error="exportDirectoryError"
          @update:settings="updateSettings"
          @browse-export-directory="chooseExportDirectory"
        />
        <p v-if="settingsError" class="history-error" role="alert">{{ settingsError }}</p>
      </template>

      <template v-else-if="currentScreen.kind === 'editor'">
        <div class="command-bar">
          <button class="toolbar-btn" type="button" @click="goHome"><span aria-hidden="true">⌂</span> {{ t("首页", "Home") }}</button>
          <button class="toolbar-btn back-btn" type="button" @click="goBack"><span aria-hidden="true">←</span> {{ t("返回", "Back") }}</button>
          <span class="command-divider"></span>
          <span class="command-context">{{ currentScreen.entry === 'new' ? t('新建信件', 'New letter') : currentScreen.entry === 'template' ? t('从模板开始', 'From template') : t('编辑信件', 'Edit letter') }}</span>
          <div class="toolbar-segment right">
            <button class="toolbar-btn" type="button" @click="openHistoryScreen">{{ t("历史", "History") }}</button>
          </div>
        </div>
      </template>
      <KeepAlive>
        <postcardEditor
          v-if="currentScreen.kind === 'editor'"
          :key="currentScreen.sessionId"
          :entry-mode="currentScreen.entry"
          :selected-card-id="currentScreen.cardId"
          :initial-template="currentScreen.template"
          :editor-session-id="currentScreen.sessionId"
          :export-directory="settings.exportDirectory"
          :export-color-mode="settings.exportColorMode"
          @export="handleExport"
        />
      </KeepAlive>
    </main>
    <ThanksMenu v-if="showThanks" @close="closeThanks" />
  </div>
</template>

<style scoped>
.app-shell {
  --app-bg: #f2f5f8;
  --surface: #ffffff;
  --surface-alt: #f5f7f9;
  --surface-hover: #edf4fa;
  --text: #202a34;
  --muted: #66727e;
  --subtle: #84909b;
  --border: #d8e0e7;
  --border-strong: #c3ced8;
  --accent: #0078d4;
  --accent-hover: #0067b8;
  --accent-tint: #eaf4fc;
  --success: #107c41;
  min-height: 100vh;
  color: var(--text);
  background: var(--app-bg);
  color-scheme: light;
  font-family: var(--ui-font-family);
  font-size: var(--ui-font-size);
  transition: color 0.18s ease, background-color 0.18s ease;
}

.app-shell[data-theme="dark"] {
  --app-bg: #191c20;
  --surface: #24292f;
  --surface-alt: #20252a;
  --surface-hover: #303941;
  --text: #e8edf2;
  --muted: #b0bac4;
  --subtle: #8b98a4;
  --border: #3a424a;
  --border-strong: #4a555f;
  --accent: #4aa8f4;
  --accent-hover: #72bbf7;
  --accent-tint: #22384a;
  --success: #6ccf8d;
  color-scheme: dark;
}

.app-bar {
  height: 56px;
  padding: 0 max(24px, calc((100vw - 1240px) / 2));
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.app-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.thanks-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid #d7a0a0;
  border-radius: 3px;
  background: #fbefef;
  color: #98464b;
  font: inherit;
  font-size: 0.8571em;
  font-weight: 650;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.thanks-toggle:hover {
  border-color: #bd7376;
  background: #f6e3e3;
  color: #84393e;
}

.app-shell[data-theme="dark"] .thanks-toggle {
  border-color: #815155;
  background: #39282b;
  color: #edb2b3;
}

.app-shell[data-theme="dark"] .thanks-toggle:hover {
  border-color: #b97378;
  background: #493034;
  color: #ffd0d0;
}

.thanks-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.brand,
.theme-toggle {
  display: flex;
  align-items: center;
}

.brand {
  gap: 11px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 0.9286em;
  font-family: inherit;
  cursor: pointer;
}

.brand:hover .brand-name {
  color: var(--accent);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  background: var(--accent);
  color: #fff;
  font-size: 1.2857em;
}

.brand-name {
  font-weight: 650;
  letter-spacing: 0.01em;
}

.brand-divider,
.command-divider {
  width: 1px;
  height: 18px;
  background: var(--border-strong);
}

.brand-product {
  color: var(--muted);
}

.theme-toggle {
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--surface-alt);
  border-color: var(--border);
  color: var(--text);
}

.theme-toggle svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.container {
  padding: 28px 24px 64px;
  max-width: 1240px;
  margin: 0 auto;
}

.welcome,
.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.welcome {
  padding: 50px 0 30px;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 0.8571em;
  font-weight: 650;
  letter-spacing: 0.09em;
}

.page-title {
  margin: 0;
  color: var(--text);
  font-size: clamp(2em, calc(var(--ui-font-size) * 2.1), 2.57em);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.page-subtitle {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 1em;
  line-height: 1.6;
}

.welcome-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0 0 3px;
}

.stat-number {
  color: var(--text);
  font-size: 2.1429em;
  font-weight: 600;
  line-height: 1;
}

.stat-label {
  margin-top: 7px;
  color: var(--muted);
  font-size: 0.8571em;
}

.window-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.toolbar-segment {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-segment.right {
  margin-left: auto;
}

.command-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--border);
}

.command-context {
  color: var(--muted);
  font-size: 0.9286em;
}

.toolbar-btn,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  border-radius: 2px;
  padding: 6px 13px;
  font-size: 0.9286em;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.toolbar-btn:hover,
.secondary-button:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.toolbar-btn:focus-visible,
.secondary-button:focus-visible,
.theme-toggle:focus-visible,
.thanks-toggle:focus-visible,
.home-card:focus-visible,
.history-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.primary-command {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.primary-command:hover {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
  color: #fff;
}

.home-shell {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 8px;
}

.home-card {
  position: relative;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 22px;
  align-items: start;
  gap: 18px;
  min-height: 166px;
  padding: 25px 24px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  color: var(--text);
  font: inherit;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.home-card:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.home-card.primary {
  border-left-color: var(--accent);
}

.card-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  color: var(--accent);
  background: var(--accent-tint);
}

.card-icon svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.home-card-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.home-card-label {
  margin: 2px 0 9px;
  font-size: 0.8571em;
  color: var(--muted);
}

.home-card strong {
  font-size: 1.4286em;
  font-weight: 600;
}

.home-card small {
  margin-top: 9px;
  color: var(--muted);
  font-size: 0.9286em;
  line-height: 1.5;
}

.card-arrow {
  align-self: center;
  color: var(--subtle);
  font-size: 1.4286em;
}

.home-card:hover .card-arrow,
.history-item:hover .history-open {
  color: var(--accent);
}

.home-footnote {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 22px 0;
  color: var(--subtle);
  font-size: 0.8571em;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
}

.panel-shell {
  border: 1px solid var(--border);
  background: var(--surface);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.panel-header h2 {
  margin: 0;
  font-size: 1em;
  color: var(--text);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 54px 20px;
  color: var(--muted);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 4px;
  background: var(--accent-tint);
  color: var(--accent);
  font-size: 1.7143em;
}

.empty-state strong {
  color: var(--text);
  font-size: 1.0714em;
}

.empty-state > span:not(.empty-icon) {
  margin-bottom: 8px;
  font-size: 0.9286em;
}

.history-item {
  cursor: pointer;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

.history-item:last-child {
  border-bottom: 0;
}

.history-entry:last-child .history-item {
  border-bottom: 0;
}

.history-item:hover {
  background: var(--surface-alt);
}

.history-item:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.history-open-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
}

.history-open:focus-visible,
.delete-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.history-type-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  background: var(--surface-alt);
  color: var(--accent);
  font-size: 1.3571em;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.history-title,
.history-address,
.history-note,
.history-date {
  overflow-wrap: anywhere;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 1em;
  font-weight: 600;
}

.type-tag {
  padding: 2px 6px;
  background: var(--surface-alt);
  color: var(--muted);
  font-size: 0.7143em;
  font-weight: 500;
}

.history-address,
.history-note,
.history-date {
  color: var(--muted);
  font-size: 0.8571em;
}

.history-note {
  color: var(--accent);
}

.history-open {
  padding: 6px 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 0.8571em;
  cursor: pointer;
}

.history-open:hover {
  border-color: var(--border-strong);
  color: var(--accent);
}

.history-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.history-details {
  padding: 14px 18px 16px 72px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-alt);
  color: var(--muted);
  font-size: 0.8571em;
  line-height: 1.7;
}

.history-details p {
  margin: 4px 0;
}

.history-details strong {
  color: var(--text);
  font-weight: 600;
}

.detail-copy {
  display: block;
  margin: 3px 0 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.delete-button {
  min-height: 30px;
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
}

.delete-button:hover {
  border-color: #c84840;
  background: #fdf0ef;
  color: #a52822;
}

.app-shell[data-theme="dark"] .delete-button {
  border-color: #653631;
  background: #342422;
  color: #f09a91;
}

.app-shell[data-theme="dark"] .delete-button:hover {
  border-color: #a94d43;
  background: #492a27;
  color: #ffc0b9;
}

.history-error {
  margin: 0 0 12px;
  color: #a52822;
  font-size: 0.9286em;
}

.history-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 900px) {
  .home-shell {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .app-bar {
    height: 52px;
    padding: 0 16px;
  }

  .brand-product,
  .brand-divider {
    display: none;
  }

  .theme-toggle {
    gap: 5px;
    padding: 7px;
  }

  .app-actions .theme-toggle span {
    display: none;
  }

  .thanks-toggle {
    min-height: 32px;
    padding: 5px 8px;
  }

  .container {
    padding: 14px 16px 44px;
  }

  .welcome {
    padding: 36px 0 24px;
  }

  .welcome-stat {
    display: none;
  }

  .home-shell {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .history-item {
    grid-template-columns: 36px minmax(0, 1fr) auto;
    gap: 9px;
    padding: 14px 12px;
  }

  .history-details {
    padding: 12px;
  }

  .history-open {
    display: none;
  }

  .history-actions {
    gap: 0;
  }

  .command-bar {
    gap: 8px;
    margin-bottom: 22px;
  }

  .command-context {
    font-size: 0.8571em;
  }

  .toolbar-btn {
    padding: 6px 9px;
  }

  .page-heading {
    align-items: flex-start;
  }

  .count-badge {
    flex: 0 0 auto;
  }
}

.page-heading {
  margin: 0 0 20px;
}

.count-badge {
  padding: 6px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 0.8571em;
}
</style>
<style>
:root {
  line-height: 1.5;
  font-weight: 400;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}
</style>