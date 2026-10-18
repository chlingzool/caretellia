<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { decodeClc, MAX_CLC_FILE_SIZE } from "./clc";
import {
  deleteViewedFile,
  listHistory,
  listViewedFiles,
  rememberViewedFile,
  type ViewedFile,
} from "./letterHistory";
import { locale, t } from "./i18n";
import type { PostcardData } from "./types/postcard";
import "./postcard-display.css";

const emit = defineEmits<{ (event: "back"): void }>();
const props = defineProps<{ recentViewLimit: number }>();

const history = ref<PostcardData[]>([]);
const recentFiles = ref<ViewedFile[]>([]);
const selectedCard = ref<PostcardData | null>(null);
const availableFiles = ref<Record<string, boolean>>({});
const loading = ref(false);
const errorMessage = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const isEnvelopeOpened = ref(false);
const isEnvelopeExpanded = ref(false);
const isPostcardFlipped = ref(false);

const safeMessageHtml = computed(() => sanitizeRichText(
  selectedCard.value?.messageHtml || plainTextHtml(selectedCard.value?.message ?? ""),
));
const safeBackCaptionHtml = computed(() => sanitizeRichText(
  selectedCard.value?.backCaptionHtml || plainTextHtml(selectedCard.value?.backCaption ?? ""),
));

function sanitizeRichText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set([
    "P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "S",
    "UL", "OL", "LI", "BLOCKQUOTE",
  ]);
  const cleanNode = (node: Node): void => {
    for (const child of [...node.childNodes]) {
      if (child instanceof Element) {
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent ?? ""));
        } else {
          [...child.attributes].forEach((attribute) => child.removeAttribute(attribute.name));
          cleanNode(child);
        }
      }
    }
  };
  cleanNode(template.content);
  return template.innerHTML;
}

function plainTextHtml(text: string): string {
  return text.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageOrText(source: string, text: string): string {
  return source ? `<img src="${source}" alt="">` : escapeHtml(text);
}

function titleForCard(card: PostcardData): string {
  return card.title || t("未命名信件", "Untitled letter");
}

async function refreshLists() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [historyItems, viewedItems] = await Promise.all([
      listHistory(),
      listViewedFiles(props.recentViewLimit),
    ]);
    history.value = historyItems;
    recentFiles.value = viewedItems;
    const availability: Record<string, boolean> = {};
    for (const file of viewedItems) {
      if (file.path && "__TAURI_INTERNALS__" in window) {
        try {
          availability[file.id] = await invoke<boolean>("local_clc_file_exists", { filePath: file.path });
        } catch (error) {
          console.error("Unable to check viewed CLC file:", error);
          availability[file.id] = false;
        }
      } else {
        availability[file.id] = file.data !== null;
      }
    }
    availableFiles.value = availability;
  } catch (error) {
    console.error("Unable to load envelope viewer entries:", error);
    errorMessage.value = t("无法读取信件，请检查本机缓存后重试。", "Could not load letters. Check local storage and try again.");
  } finally {
    loading.value = false;
  }
}

function selectHistoryCard(card: PostcardData) {
  selectedCard.value = card;
  isEnvelopeOpened.value = false;
  isEnvelopeExpanded.value = false;
  isPostcardFlipped.value = false;
  errorMessage.value = "";
}

async function selectViewedFile(file: ViewedFile) {
  if (!availableFiles.value[file.id]) return;
  try {
    const bytes = file.path && "__TAURI_INTERNALS__" in window
      ? Uint8Array.from(await invoke<number[]>("read_clc_file", { filePath: file.path }))
      : file.data;
    if (!bytes) throw new Error("查看文件副本不存在");
    selectHistoryCard(await decodeClc(bytes));
    const updatedFile = { ...file, data: file.path ? null : file.data };
    await rememberViewedFile(updatedFile, props.recentViewLimit);
    await refreshLists();
  } catch (error) {
    console.error("Unable to open previously viewed CLC file:", error);
    availableFiles.value = { ...availableFiles.value, [file.id]: false };
    errorMessage.value = t("文件已不存在或无法读取；你可以移除这条占位记录。", "The file is missing or unreadable. You can remove this placeholder.");
  }
}

async function rememberAndView(bytes: Uint8Array, name: string, path: string | null) {
  if (bytes.byteLength > MAX_CLC_FILE_SIZE) throw new Error("CLC 文件超过允许的大小限制");
  const card = await decodeClc(bytes);
  const id = path ?? `browser:${crypto.randomUUID()}`;
  await rememberViewedFile({ id, name, path, data: path ? null : bytes }, props.recentViewLimit);
  await refreshLists();
  selectHistoryCard(card);
}

function fileNameFromPath(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? "letter.clc";
}

async function chooseLocalFile() {
  errorMessage.value = "";
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const path = await openFileDialog({
        multiple: false,
        title: t("选择本地 CLC 信件", "Choose a local CLC letter"),
        filters: [{ name: "Caretellia Letter Config", extensions: ["clc"] }],
      });
      if (typeof path !== "string") return;
      const bytes = Uint8Array.from(await invoke<number[]>("read_clc_file", { filePath: path }));
      await rememberAndView(bytes, fileNameFromPath(path), path);
    } catch (error) {
      console.error("Unable to open local CLC file:", error);
      errorMessage.value = t(`无法打开 CLC 文件：${error instanceof Error ? error.message : String(error)}`, `Could not open CLC file: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    fileInput.value?.click();
  }
}

async function onFileSelected(event: Event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    if (file.size > MAX_CLC_FILE_SIZE) throw new Error("CLC 文件超过允许的大小限制");
    await rememberAndView(new Uint8Array(await file.arrayBuffer()), file.name, null);
  } catch (error) {
    console.error("Unable to import CLC for viewing:", error);
    errorMessage.value = t(`无法查看 CLC 文件：${error instanceof Error ? error.message : String(error)}`, `Could not view CLC file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function removeViewedFile(file: ViewedFile) {
  try {
    await deleteViewedFile(file.id);
    recentFiles.value = recentFiles.value.filter((item) => item.id !== file.id);
    const next = { ...availableFiles.value };
    delete next[file.id];
    availableFiles.value = next;
    if (selectedCard.value?.id === file.id) selectedCard.value = null;
  } catch (error) {
    console.error("Unable to remove viewed-file placeholder:", error);
    errorMessage.value = t("无法移除这条最近查看记录。", "Could not remove this recently viewed entry.");
  }
}

function toggleEnvelope() {
  if (!isEnvelopeOpened.value) {
    isEnvelopeOpened.value = true;
    window.setTimeout(() => {
      if (isEnvelopeOpened.value) isEnvelopeExpanded.value = true;
    }, 450);
  } else if (isEnvelopeExpanded.value) {
    isEnvelopeExpanded.value = false;
    window.setTimeout(() => {
      isEnvelopeOpened.value = false;
    }, 400);
  } else {
    isEnvelopeExpanded.value = true;
  }
}

function togglePostcard() {
  isPostcardFlipped.value = !isPostcardFlipped.value;
}

onMounted(() => void refreshLists());
</script>

<template>
  <div class="viewer">
    <div class="command-bar">
      <button class="toolbar-btn" type="button" @click="emit('back')"><span aria-hidden="true">←</span> {{ t("返回", "Back") }}</button>
      <span class="command-divider"></span>
      <span class="command-context">{{ t("查看信封", "View letters") }}</span>
      <div class="toolbar-segment right">
        <input ref="fileInput" type="file" accept=".clc,application/octet-stream" hidden @change="onFileSelected" />
        <button class="toolbar-btn primary-command" type="button" @click="chooseLocalFile">{{ t("查看本地 CLC", "View local CLC") }}</button>
      </div>
    </div>

    <p v-if="errorMessage" class="viewer-error" role="alert">{{ errorMessage }}</p>
    <div class="viewer-layout">
      <aside class="viewer-library">
        <details class="viewer-section" open>
          <summary class="viewer-section-heading">
            <h2>{{ t("历史信件", "Saved letters") }}</h2>
            <span>{{ history.length }}</span>
          </summary>
          <p v-if="loading && history.length === 0" class="viewer-empty">{{ t("正在读取…", "Loading…") }}</p>
          <p v-else-if="history.length === 0" class="viewer-empty">{{ t("没有已保存的信件。", "No saved letters.") }}</p>
          <article v-for="card in history" :key="card.id" class="viewer-entry">
            <button class="viewer-entry-main" type="button" @click="selectHistoryCard(card)">
              <strong>{{ titleForCard(card) }}</strong>
              <span>{{ card.type === "envelope" ? t("信封", "Envelope") : card.type === "letter" ? t("信纸", "Letter sheet") : t("明信片", "Postcard") }}</span>
            </button>
          </article>
        </details>

        <details class="viewer-section">
          <summary class="viewer-section-heading">
            <h2>{{ t("最近查看", "Recently viewed") }}</h2>
            <span>{{ recentFiles.length }} / {{ props.recentViewLimit }}</span>
          </summary>
          <p v-if="recentFiles.length === 0" class="viewer-empty">{{ t("查看本地 CLC 文件后会显示在这里，不会加入历史信件。", "Local CLC files appear here after viewing. They are not added to saved letters.") }}</p>
          <article
            v-for="file in recentFiles"
            :key="file.id"
            class="viewer-entry"
            :class="{ missing: !availableFiles[file.id] }"
          >
            <button
              v-if="availableFiles[file.id]"
              class="viewer-entry-main"
              type="button"
              @click="selectViewedFile(file)"
            >
              <strong><span class="file-mark" aria-hidden="true">▤</span>{{ file.name }}</strong>
              <span>{{ new Date(file.viewedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") }}</span>
            </button>
            <div v-else class="viewer-entry-main viewer-missing">
              <strong><span class="file-mark" aria-hidden="true">▤</span>{{ file.name }}</strong>
              <span>{{ t("文件已不存在", "File no longer exists") }}</span>
            </div>
            <button
              v-if="!availableFiles[file.id]"
              class="viewer-entry-remove"
              type="button"
              :aria-label="t(`从最近查看中移除 ${file.name}`, `Remove ${file.name} from recent files`)"
              @click="removeViewedFile(file)"
            >{{ t("移除记录", "Remove") }}</button>
            <button
              v-else
              class="viewer-entry-remove"
              type="button"
              :aria-label="t(`删除最近查看记录 ${file.name}`, `Delete recent entry ${file.name}`)"
              @click="removeViewedFile(file)"
            >×</button>
          </article>
        </details>
      </aside>

      <section class="viewer-preview-panel" :aria-label="t('信件预览', 'Letter preview')">
        <div v-if="!selectedCard" class="viewer-preview-empty">
          <span aria-hidden="true">✉</span>
          <strong>{{ t("选择一封信件开始查看", "Choose a letter to view") }}</strong>
          <button class="toolbar-btn" type="button" @click="chooseLocalFile">{{ t("查看本地 CLC", "View local CLC") }}</button>
        </div>
        <template v-else>
          <header class="viewer-preview-heading">
            <div>
              <span>{{ t("正在查看", "Viewing") }}</span>
              <h1>{{ titleForCard(selectedCard) }}</h1>
            </div>
            <button class="toolbar-btn" type="button" @click="selectedCard = null">{{ t("关闭预览", "Close preview") }}</button>
          </header>

          <div v-if="selectedCard.type === 'envelope'" class="viewer-stage">
            <div class="mail-stage" :class="{ opened: isEnvelopeOpened, expanded: isEnvelopeExpanded }" @click="toggleEnvelope">
              <div class="letter-mask">
                <div class="letter-paper" :style="{ '--font-scale': selectedCard.fontSize / 18 }">
                  <div class="paper-lines rich-text-body" :style="{ fontFamily: selectedCard.messageFont }" v-html="safeMessageHtml"></div>
                  <div class="paper-footer" :style="{ fontFamily: selectedCard.fromFont }"><span>{{ selectedCard.from }}</span><span>{{ selectedCard.to }}</span></div>
                </div>
              </div>
              <div class="mail-base">
                <div class="envelope-body">
                  <div class="stamp-box" :style="{ fontFamily: selectedCard.stampFont }" v-html="imageOrText(selectedCard.stampImage, selectedCard.stampText || '✉')"></div>
                  <div class="address-area" :style="{ fontFamily: selectedCard.toFont }"><span class="to-label">TO:</span><span class="name-text">{{ selectedCard.to }}</span></div>
                </div>
                <div class="envelope-flap"></div>
              </div>
            </div>
            <p class="viewer-hint">{{ isEnvelopeExpanded ? t("点击收回信纸", "Click to return the letter") : t("点击打开信封并抽出信纸", "Click to open the envelope and pull out the letter") }}</p>
          </div>

          <div v-else-if="selectedCard.type === 'postcard'" class="viewer-stage">
            <div class="flip-scene">
              <div class="flip-card" :class="{ flipped: isPostcardFlipped }" @click="togglePostcard">
                <div class="flip-face flip-front">
                  <div class="card-image-frame"><div class="card-image-wrap">
                    <img v-if="selectedCard.cardImage" :src="selectedCard.cardImage" alt="" />
                    <div v-else class="image-placeholder">{{ t("没有上传图片", "No image uploaded") }}</div>
                  </div></div>
                  <div class="card-caption-front"><span class="caption-text" :style="{ fontFamily: selectedCard.captionFont }">{{ selectedCard.caption }}</span></div>
                </div>
                <div class="flip-face flip-back" :style="{ backgroundColor: selectedCard.bgColor, color: selectedCard.textColor, fontSize: `${selectedCard.fontSize}px`, border: `1px ${selectedCard.borderStyle} ${selectedCard.borderColor}` }">
                  <div class="card-back">
                    <div class="card-writing-area" :style="{ fontFamily: selectedCard.backCaptionFont, '--writing-paper': selectedCard.bgColor }">
                      <div class="card-stamp-box" :style="{ borderColor: selectedCard.borderColor, fontFamily: selectedCard.stampFont }" v-html="imageOrText(selectedCard.stampImage, selectedCard.stampText || '✉')"></div>
                      <div class="writing-copy rich-text-body" v-html="safeBackCaptionHtml"></div>
                    </div>
                    <div class="card-footer" :style="{ fontFamily: selectedCard.fromFont }"><span>{{ selectedCard.from }}</span><span>{{ selectedCard.to }}</span></div>
                  </div>
                </div>
              </div>
            </div>
            <p class="viewer-hint">{{ t("点击明信片翻面", "Click to flip the postcard") }}</p>
          </div>

          <div v-else class="viewer-stage letter-stage">
            <div class="letter-sheet-frame">
              <article class="letter-sheet" :style="{ backgroundColor: selectedCard.bgColor, color: selectedCard.textColor, fontFamily: selectedCard.messageFont, fontSize: `${selectedCard.fontSize}px`, border: `1px ${selectedCard.borderStyle} ${selectedCard.borderColor}` }">
                <h1 :style="{ fontFamily: selectedCard.titleFont }">{{ selectedCard.title }}</h1>
                <div class="letter-sheet-content rich-text-body" v-html="safeMessageHtml"></div>
                <img
                  v-for="sticker in selectedCard.stickers ?? []"
                  :key="sticker.id"
                  class="letter-sticker"
                  :src="sticker.src"
                  alt=""
                  :style="{ left: `${sticker.x}%`, top: `${sticker.y}%`, width: `${sticker.width}%`, aspectRatio: String(sticker.aspectRatio), transform: `rotate(${sticker.rotation}deg)` }"
                />
              </article>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  color: var(--text);
}

.command-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--border);
}

.command-context,
.viewer-section-heading span,
.viewer-entry-main > span,
.viewer-preview-heading > div > span {
  color: var(--muted);
  font-size: 0.9em;
}

.toolbar-segment.right {
  margin-left: auto;
}

.toolbar-btn {
  min-height: 34px;
  padding: 6px 13px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}

.toolbar-btn:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.primary-command {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.viewer-error {
  margin: 0 0 14px;
  color: #a52822;
}

.viewer-layout {
  display: grid;
  grid-template-columns: minmax(250px, 0.82fr) minmax(0, 1.8fr);
  gap: 18px;
  align-items: start;
}

.viewer-library,
.viewer-preview-panel {
  min-width: 0;
  border: 1px solid var(--border);
  background: var(--surface);
}

.viewer-library {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100vh - 150px);
  overflow: auto;
}

.viewer-library section + section {
  border-top: 1px solid var(--border);
}

.viewer-section + .viewer-section {
  border-top: 1px solid var(--border);
}

.viewer-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px 10px;
  list-style: none;
  cursor: pointer;
}

.viewer-section-heading::-webkit-details-marker {
  display: none;
}

.viewer-section-heading::before {
  content: "▸";
  color: var(--muted);
  font-size: 0.85em;
  transition: transform 0.12s ease;
}

.viewer-section[open] > .viewer-section-heading::before {
  transform: rotate(90deg);
}

.viewer-section-heading h2 {
  flex: 1;
}

.viewer-section-heading h2 {
  margin: 0;
  font-size: 1em;
}

.viewer-section-heading span {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-alt);
}

.viewer-empty {
  margin: 0;
  padding: 10px 16px 16px;
  color: var(--muted);
  font-size: 0.9em;
  line-height: 1.5;
}

.viewer-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-top: 1px solid var(--border);
}

.viewer-entry-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
}

button.viewer-entry-main {
  cursor: pointer;
}

button.viewer-entry-main:hover strong {
  color: var(--accent);
}

.viewer-entry-main strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.95em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-entry-main > span {
  font-size: 0.8em;
}

.viewer-entry-remove {
  flex: none;
  padding: 5px 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.82em;
  cursor: pointer;
}

.viewer-entry-remove:hover {
  border-color: var(--border-strong);
  color: var(--accent);
}

.viewer-entry.missing {
  background: var(--surface-alt);
}

.viewer-missing strong,
.viewer-missing > span {
  color: var(--muted);
}

.file-mark {
  margin-right: 7px;
  color: var(--accent);
}

.viewer-preview-panel {
  min-height: 520px;
  padding: 20px;
}

.viewer-preview-empty {
  display: flex;
  min-height: 470px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--muted);
  text-align: center;
}

.viewer-preview-empty > span {
  color: var(--accent);
  font-size: 2.6em;
}

.viewer-preview-empty strong {
  color: var(--text);
  font-size: 1.1em;
}

.viewer-preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.viewer-preview-heading h1 {
  margin: 4px 0 0;
  font-size: 1.25em;
}

.viewer-stage {
  display: flex;
  min-height: 430px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible;
  padding: 12px;
  background: var(--surface-alt);
}

.viewer-stage :deep(.mail-stage),
.viewer-stage :deep(.flip-scene) {
  width: min(100%, 660px);
}

.viewer-stage :deep(.mail-stage) {
  height: auto;
  aspect-ratio: 8 / 5;
}

.viewer-stage :deep(.mail-stage.expanded) {
  aspect-ratio: auto;
}

.viewer-stage :deep(.flip-scene) {
  aspect-ratio: 8 / 5;
}

.viewer-stage :deep(.flip-face) {
  cursor: pointer;
}

.viewer-stage :deep(.letter-sheet-frame) {
  width: min(100%, 720px);
}

.viewer-stage :deep(.letter-sheet) {
  min-height: 450px;
}

.viewer-hint {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 0.88em;
  text-align: center;
}

@media (max-width: 820px) {
  .viewer-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .viewer-library {
    max-height: 42vh;
  }

  .viewer-preview-panel {
    min-height: 430px;
    padding: 14px;
  }

}

@media (max-width: 520px) {
  .command-bar {
    gap: 8px;
  }

  .toolbar-btn {
    padding-right: 8px;
    padding-left: 8px;
    font-size: 0.9em;
  }

  .viewer-stage {
    min-height: 320px;
    padding: 8px;
  }

  .viewer-preview-panel {
    min-height: 360px;
  }

  .viewer-preview-empty {
    min-height: 320px;
  }

  .viewer-stage :deep(.mail-stage.expanded .letter-mask),
  .viewer-stage :deep(.mail-stage.expanded .letter-paper) {
    min-height: 240px;
  }
}

@media (hover: none) and (pointer: coarse) {
  .viewer-library {
    max-height: none;
    overflow: visible;
  }

  .command-bar > button,
  .toolbar-btn,
  .viewer-entry-remove {
    min-height: 44px;
  }

  .viewer-section-heading {
    min-height: 48px;
  }
}
</style>
