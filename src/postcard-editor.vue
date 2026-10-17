<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, onDeactivated, nextTick, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import FontSelect from "./components/FontSelect.vue";
import { DEFAULT_FONT_FAMILIES, SYSTEM_DEFAULT_FONT, useSystemFonts } from "./composables/useSystemFonts";
import type { LetterSticker, LetterTemplate, PostcardData } from "./types/postcard";
import postcardDisplayStyles from "./postcard-display.css?inline";
import "./postcard-display.css";

const props = defineProps<{
  entryMode?: "new" | "history" | "template";
  selectedCardId?: string;
  initialTemplate?: LetterTemplate;
  editorSessionId?: string;
  exportDirectory?: string;
  exportColorMode?: "light" | "dark" | "system";
}>();

const emit = defineEmits<{
  (e: "save", data: PostcardData): void;
  (e: "export", data: PostcardData): void;
}>();

const MAX = {
  title: 24,
  caption: 60,
  from: 20,
  to: 20,
  stampText: 8,
};

const form = reactive<PostcardData>({
  id: crypto.randomUUID(),
  type: "postcard",
  title: "A Letter",
  message: "亲爱的朋友，\n\n愿你今天也拥有美好的一天。\n\n带着爱，",
  messageHtml: "",
  caption: "愿你此刻闪耀",
  backCaption: "背面写字区域",
  backCaptionHtml: "",
  note: "",
  from: "来自：我",
  to: "致：你",
  bgColor: "#f8f7f3",
  textColor: "#41433f",
  fontSize: 18,
  borderStyle: "solid",
  borderColor: "#c6c6bf",
  stampText: "✉",
  stampImage: "",
  cardImage: "",
  stickers: [],
  titleFont: "Georgia",
  messageFont: "Georgia",
  captionFont: "Georgia",
  backCaptionFont: "Georgia",
  fromFont: "Georgia",
  toFont: "Georgia",
  stampFont: "Arial",
  createdAt: new Date().toISOString(),
});
const messageEditor = ref<HTMLElement | null>(null);
const backCaptionEditor = ref<HTMLElement | null>(null);
const activeRichEditor = ref<HTMLElement | null>(null);
const activeRichFormats = ref({ bold: false, italic: false, underline: false, unorderedList: false, orderedList: false });
const letterCanvas = ref<HTMLElement | null>(null);
const selectedStickerId = ref<string | null>(null);
type StickerInteraction = {
  kind: "move" | "resize" | "rotate";
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  rotation: number;
  canvas: DOMRect;
  centerX: number;
  centerY: number;
  startAngle: number;
};
let stickerInteraction: StickerInteraction | null = null;

function uploadStickers(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files) return;
  for (const file of [...input.files]) {
    if (!file.type.startsWith("image/")) continue;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const sticker: LetterSticker = {
        id: crypto.randomUUID(),
        src: reader.result,
        x: 38 + Math.random() * 12,
        y: 24 + Math.random() * 12,
        width: 24,
        aspectRatio: 1,
        rotation: 0,
      };
      const image = new Image();
      image.onload = () => {
        sticker.aspectRatio = image.naturalWidth / image.naturalHeight || 1;
      };
      image.src = reader.result;
      form.stickers = [...(form.stickers ?? []), sticker];
      selectedStickerId.value = sticker.id;
    };
    reader.onerror = () => console.error("Unable to read uploaded letter sticker:", reader.error);
    reader.readAsDataURL(file);
  }
  input.value = "";
}

function beginStickerInteraction(kind: StickerInteraction["kind"], sticker: LetterSticker, event: PointerEvent) {
  const canvas = letterCanvas.value;
  if (!canvas) return;
  event.preventDefault();
  event.stopPropagation();
  const canvasBounds = canvas.getBoundingClientRect();
  const element = canvas.querySelector<HTMLElement>(`[data-sticker-id="${CSS.escape(sticker.id)}"]`);
  if (!element) return;
  const stickerBounds = element.getBoundingClientRect();
  const centerX = stickerBounds.left + stickerBounds.width / 2;
  const centerY = stickerBounds.top + stickerBounds.height / 2;
  stickerInteraction = {
    kind,
    id: sticker.id,
    startX: event.clientX,
    startY: event.clientY,
    x: sticker.x,
    y: sticker.y,
    width: sticker.width,
    rotation: sticker.rotation,
    canvas: canvasBounds,
    centerX,
    centerY,
    startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
  };
  selectedStickerId.value = sticker.id;
  window.addEventListener("pointermove", moveSticker);
  window.addEventListener("pointerup", endStickerInteraction);
  window.addEventListener("pointercancel", endStickerInteraction);
}

function moveSticker(event: PointerEvent) {
  const interaction = stickerInteraction;
  const sticker = form.stickers?.find((item) => item.id === interaction?.id);
  if (!interaction || !sticker) return;
  const dx = event.clientX - interaction.startX;
  const dy = event.clientY - interaction.startY;
  if (interaction.kind === "move") {
    sticker.x = Math.min(100 - sticker.width, Math.max(0, interaction.x + dx / interaction.canvas.width * 100));
    sticker.y = Math.min(100, Math.max(0, interaction.y + dy / interaction.canvas.height * 100));
  } else if (interaction.kind === "resize") {
    sticker.width = Math.min(70, Math.max(8, interaction.width + dx / interaction.canvas.width * 100));
  } else {
    const angle = Math.atan2(event.clientY - interaction.centerY, event.clientX - interaction.centerX);
    sticker.rotation = interaction.rotation + (angle - interaction.startAngle) * 180 / Math.PI;
  }
}

function endStickerInteraction() {
  stickerInteraction = null;
  window.removeEventListener("pointermove", moveSticker);
  window.removeEventListener("pointerup", endStickerInteraction);
  window.removeEventListener("pointercancel", endStickerInteraction);
}

function removeSticker(stickerId: string) {
  form.stickers = (form.stickers ?? []).filter((sticker) => sticker.id !== stickerId);
  selectedStickerId.value = null;
}

function updateStickerAspect(sticker: LetterSticker, event: Event) {
  const image = event.currentTarget;
  if (image instanceof HTMLImageElement && image.naturalHeight > 0) {
    sticker.aspectRatio = image.naturalWidth / image.naturalHeight;
  }
}

function sanitizeRichTextHtml(html: string): string {
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
          const text = document.createTextNode(child.textContent ?? "");
          child.replaceWith(text);
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

function plainTextToHtml(text: string): string {
  if (!text) return "";
  return text.split(/\r?\n/).map((line) => `<p>${esc(line) || "<br>"}</p>`).join("");
}

function richTextAsPlainText(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = sanitizeRichTextHtml(html);
  return (container.innerText || container.textContent || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "");
}

const safeMessageHtml = computed(() =>
  sanitizeRichTextHtml(form.messageHtml || plainTextToHtml(form.message)),
);
const safeBackCaptionHtml = computed(() =>
  sanitizeRichTextHtml(form.backCaptionHtml || plainTextToHtml(form.backCaption)),
);

function syncRichEditors() {
  const message = messageEditor.value;
  if (message && document.activeElement !== message) {
    const html = sanitizeRichTextHtml(form.messageHtml || plainTextToHtml(form.message));
    if (message.innerHTML !== html) message.innerHTML = html;
  }
  const backCaption = backCaptionEditor.value;
  if (backCaption && document.activeElement !== backCaption) {
    const html = sanitizeRichTextHtml(form.backCaptionHtml || plainTextToHtml(form.backCaption));
    if (backCaption.innerHTML !== html) backCaption.innerHTML = html;
  }
}

watch(
  () => [form.type, form.message, form.messageHtml, form.backCaption, form.backCaptionHtml],
  () => void nextTick(syncRichEditors),
  { flush: "post" },
);

const savedCards = ref<PostcardData[]>([]);
const isOpened = ref(false);
const isExpanded = ref(false);
const isFlipped = ref(false);
const editorElement = ref<HTMLElement | null>(null);
const previewWidth = ref(46);
const isResizingPreview = ref(false);

let envelopeTransitionTimer: number | undefined;

function handleStageClick() {
  if (form.type !== "envelope") {
    isFlipped.value = !isFlipped.value;
    return;
  }

  window.clearTimeout(envelopeTransitionTimer);
  if (isExpanded.value) {
    isExpanded.value = false;
    envelopeTransitionTimer = window.setTimeout(() => {
      isOpened.value = false;
    }, 400);
  } else if (isOpened.value) {
    isExpanded.value = true;
  } else {
    isOpened.value = true;
    envelopeTransitionTimer = window.setTimeout(() => {
      if (isOpened.value) isExpanded.value = true;
    }, 500);
  }
}

function resetMail() {
  window.clearTimeout(envelopeTransitionTimer);
  isExpanded.value = false;
  isFlipped.value = false;
  envelopeTransitionTimer = window.setTimeout(() => {
    isOpened.value = false;
  }, 400);
}

function onTypeChange() {
  isFlipped.value = false;
  window.clearTimeout(envelopeTransitionTimer);
  isOpened.value = false;
  isExpanded.value = false;
}

function onCardImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    form.cardImage = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function onStampImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    form.stampImage = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function clearCardImage() {
  form.cardImage = "";
}

function clearStampImage() {
  form.stampImage = "";
}

function loadHistory() {
  try {
    const raw = localStorage.getItem("caretellia-postcards");
    if (raw) savedCards.value = JSON.parse(raw);
  } catch {
    savedCards.value = [];
  }
}

function notifyHistoryChange() {
  window.dispatchEvent(new CustomEvent("caretellia-history-changed"));
}

function saveToStorage() {
  const all = savedCards.value.filter((c) => c.id !== form.id);
  all.unshift({ ...form, note: form.note ?? "" });
  localStorage.setItem("caretellia-postcards", JSON.stringify(all.slice(0, 20)));
  savedCards.value = all;
  notifyHistoryChange();
}

function loadCard(card: PostcardData) {
  Object.assign(form, {
    titleFont: "Georgia",
    messageFont: "Georgia",
    captionFont: "Georgia",
    backCaptionFont: "Georgia",
    fromFont: "Georgia",
    toFont: "Georgia",
    stampFont: "Arial",
    note: card.note ?? "",
    messageHtml: card.messageHtml ?? "",
    backCaptionHtml: card.backCaptionHtml ?? "",
    stickers: card.stickers ?? [],
  }, card);
  onTypeChange();
}

function loadSelectedCard() {
  if (!props.selectedCardId) return;
  const selected = savedCards.value.find((card) => card.id === props.selectedCardId);
  if (selected) {
    loadCard(selected);
  }
}

function resetForm() {
  form.id = crypto.randomUUID();
  form.type = "postcard";
  form.title = "A Letter";
  form.message = "亲爱的朋友，\n\n愿你今天也拥有美好的一天。\n\n带着爱，";
  form.messageHtml = "";
  form.caption = "愿你此刻闪耀";
  form.backCaption = "背面写字区域";
  form.backCaptionHtml = "";
  form.note = "";
  form.from = "来自：我";
  form.to = "致：你";
  form.bgColor = "#f8f7f3";
  form.textColor = "#41433f";
  form.titleFont = "Georgia";
  form.messageFont = "Georgia";
  form.captionFont = "Georgia";
  form.backCaptionFont = "Georgia";
  form.fromFont = "Georgia";
  form.toFont = "Arial";
  form.stampFont = "Arial";
  form.fontSize = 18;
  form.borderStyle = "solid";
  form.borderColor = "#c6c6bf";
  form.stampText = "✉";
  form.stampImage = "";
  form.cardImage = "";
  form.stickers = [];
  selectedStickerId.value = null;
  form.createdAt = new Date().toISOString();
  onTypeChange();
}

function rememberFonts(...fonts: string[]) {
  const combined = new Set([...preservedFontOptions.value, ...fonts.filter(Boolean)]);
  preservedFontOptions.value = [...combined];
}

function applyTemplate(template: LetterTemplate) {
  resetForm();
  Object.assign(form, template.data, {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  rememberFonts(
    form.titleFont,
    form.messageFont,
    form.captionFont,
    form.backCaptionFont,
    form.fromFont,
    form.toFont,
    form.stampFont,
  );
  onTypeChange();
}

function updatePreviewWidth(event: PointerEvent) {
  const editor = editorElement.value;
  if (!editor) return;
  const bounds = editor.getBoundingClientRect();
  previewWidth.value = Math.min(68, Math.max(34, ((bounds.right - event.clientX) / bounds.width) * 100));
}

function stopPreviewResize() {
  if (!isResizingPreview.value) return;
  isResizingPreview.value = false;
  window.removeEventListener("pointermove", updatePreviewWidth);
  window.removeEventListener("pointerup", stopPreviewResize);
}

function startPreviewResize(event: PointerEvent) {
  if (window.innerWidth <= 900) return;
  event.preventDefault();
  isResizingPreview.value = true;
  window.addEventListener("pointermove", updatePreviewWidth);
  window.addEventListener("pointerup", stopPreviewResize);
}

function adjustPreviewWidth(event: KeyboardEvent) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    previewWidth.value = Math.min(68, previewWidth.value + 2);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    previewWidth.value = Math.max(34, previewWidth.value - 2);
  }
}

function handleSave() {
  saveToStorage();
  emit("save", { ...form });
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stickerMarkup(sticker: LetterSticker): string {
  return `<img class="letter-sticker" src="${esc(sticker.src)}" alt="" style="position:absolute;left:${sticker.x}%;top:${sticker.y}%;width:${sticker.width}%;height:auto;aspect-ratio:${sticker.aspectRatio};transform:rotate(${sticker.rotation}deg)">`;
}

function syncRichText(field: "message" | "backCaption", editor: HTMLElement) {
  const html = sanitizeRichTextHtml(editor.innerHTML);
  if (editor.innerHTML !== html) editor.innerHTML = html;
  const text = richTextAsPlainText(html);
  if (field === "message") {
    form.message = text;
    form.messageHtml = html;
  } else {
    form.backCaption = text;
    form.backCaptionHtml = html;
  }
}

function onRichTextInput(field: "message" | "backCaption", event: Event) {
  if (event.currentTarget instanceof HTMLElement) {
    syncRichText(field, event.currentTarget);
    refreshRichFormatting();
  }
}

function formatRichText(field: "message" | "backCaption", command: string) {
  const editor = field === "message" ? messageEditor.value : backCaptionEditor.value;
  if (!editor) return;
  editor.focus();
  document.execCommand(command);
  syncRichText(field, editor);
  activeRichEditor.value = editor;
  refreshRichFormatting();
}

function clearRichFormatting(field: "message" | "backCaption") {
  const editor = field === "message" ? messageEditor.value : backCaptionEditor.value;
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
  const isUnorderedList = document.queryCommandState("insertUnorderedList");
  const isOrderedList = document.queryCommandState("insertOrderedList");
  editor.focus();
  document.execCommand("removeFormat");
  if (isUnorderedList) document.execCommand("insertUnorderedList");
  if (isOrderedList) document.execCommand("insertOrderedList");
  document.execCommand("formatBlock", false, "P");
  syncRichText(field, editor);
  activeRichEditor.value = editor;
  refreshRichFormatting();
}

function refreshRichFormatting() {
  const editor = activeRichEditor.value;
  const selection = window.getSelection();
  if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return;
  activeRichFormats.value = {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
    unorderedList: document.queryCommandState("insertUnorderedList"),
    orderedList: document.queryCommandState("insertOrderedList"),
  };
}

function setActiveRichEditor(event: FocusEvent) {
  if (event.currentTarget instanceof HTMLElement) {
    activeRichEditor.value = event.currentTarget;
    refreshRichFormatting();
  }
}

function generateHTML(embeddedFontCSS = ""): string {
  const fromText = form.from.replace("来自：", "");
  const toText = form.to.replace("致：", "");
  const letterWidth = letterCanvas.value?.getBoundingClientRect().width;
  const letterWidthRule = letterWidth
    ? `.letter-sheet-frame{width:min(92vw,${letterWidth.toFixed(2)}px)}`
    : "";
  const stamp = form.stampText || "✉";
  const stampImg = form.stampImage
    ? `<img src="${form.stampImage}" style="width:100%;height:100%;object-fit:cover" alt="">`
    : esc(stamp);
  const cardImg = form.cardImage
    ? `<img src="${form.cardImage}" style="width:100%;height:100%;object-fit:cover" alt="">`
    : `<div class="image-placeholder">点击上传图片</div>`;

  const envelopeHTML = `<div class="mail-stage" id="stage" style="--font-scale:${form.fontSize / 18}">
<div class="letter-mask"><div class="letter-paper"><div class="paper-lines rich-text-body" style="font-family:'${form.messageFont}'">${safeMessageHtml.value}</div><div class="paper-footer" style="font-family:'${form.fromFont}'"><span>${esc(fromText)}</span><span>${esc(toText)}</span></div></div></div>
<div class="mail-base">
<div class="envelope-body"><div class="stamp-box" style="font-family:'${form.stampFont}'">${stampImg}</div><div class="address-area" style="font-family:'${form.toFont}'"><span class="to-label">TO:</span><span class="name-text">${esc(toText)}</span></div></div>
<div class="envelope-flap"></div>
</div>
</div>
<div class="hint-bar" id="hint">点击打开信纸</div>`;

  const letterHTML = `<div class="letter-sheet-frame" style="--font-scale:${form.fontSize / 18}"><article class="letter-sheet" style="background-color:${form.bgColor};color:${form.textColor};font-family:'${form.messageFont}';font-size:${form.fontSize}px;border:1px ${form.borderStyle} ${form.borderColor}">
<h1 style="font-family:'${form.titleFont}'">${esc(form.title)}</h1>
<div class="letter-sheet-content rich-text-body">${safeMessageHtml.value}</div>
${(form.stickers ?? []).map(stickerMarkup).join("")}
</article></div>`;

  const postcardHTML = `<div class="flip-scene" id="stage" style="--font-scale:${form.fontSize / 18}">
<div class="flip-card" id="flipCard">
<div class="flip-face flip-front">
<div class="card-image-frame">
<div class="card-image-wrap">${cardImg}</div>
</div>
<div class="card-caption-front"><span class="caption-text" style="font-family:'${form.captionFont}'">${esc(form.caption)}</span></div>
</div>
<div class="flip-face flip-back" style="background-color:${form.bgColor};color:${form.textColor};font-size:${form.fontSize}px;border:1px ${form.borderStyle} ${form.borderColor}">
<div class="card-back">
<div class="card-writing-area" style="font-family:'${form.backCaptionFont}';--writing-paper:${form.bgColor}">
<div class="card-stamp-box" style="border-color:${form.borderColor};font-family:'${form.stampFont}'">${stampImg}</div>
<div class="writing-copy rich-text-body">${safeBackCaptionHtml.value}</div>
</div>
<div class="card-footer" style="font-family:'${form.fromFont}'"><span>${esc(fromText)}</span><span>${esc(toText)}</span></div>
</div>
</div>
</div>
</div>
<div class="hint-bar" id="hint">点击明信片翻面</div>`;

  const stageHTML = form.type === "envelope"
    ? envelopeHTML
    : form.type === "letter" ? letterHTML : postcardHTML;

  const envelopeScript = `
var isOpened=false,isExpanded=false,transitionTimer;
var stage=document.getElementById("stage"),hint=document.getElementById("hint");
stage.addEventListener("click",function(){
  clearTimeout(transitionTimer);
  if(isExpanded){isExpanded=false;upd();transitionTimer=setTimeout(function(){isOpened=false;upd()},400);}
  else if(isOpened){isExpanded=true;upd();}
  else{isOpened=true;upd();transitionTimer=setTimeout(function(){if(isOpened){isExpanded=true;upd();}},500);}
});
function upd(){
  stage.className="mail-stage"+(isOpened?" opened":"")+(isExpanded?" expanded":"");
  stage.style.cursor=isExpanded?"default":"pointer";
  hint.textContent=!isOpened?"点击信封开封":!isExpanded?"再次点击展开信纸":"点击收起信纸并合上信封";
}`;

  const postcardScript = `
var flipped=false;
var stage=document.getElementById("stage"),hint=document.getElementById("hint"),flipCard=document.getElementById("flipCard");
stage.addEventListener("click",function(){
  flipped=!flipped;
  flipCard.classList.toggle("flipped",flipped);
  hint.textContent=flipped?"点击明信片翻回":"点击明信片翻面";
});`;

  const script = form.type === "envelope" ? envelopeScript : form.type === "postcard" ? postcardScript : "";
  const titleBar = form.type === "letter"
    ? ""
    : `<div class="title-bar"><h1>${esc(form.title)}</h1></div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(form.title)}</title>
<style>
${embeddedFontCSS}
*{margin:0;padding:0;box-sizing:border-box}
body{--font-scale:${form.fontSize / 18};min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:24px;padding:82px 16px 70px;background:#f1f0ec;overflow:auto;font-family:Georgia,"Noto Serif SC",serif}
.title-bar{position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:100}
.title-bar h1{font-size:calc(20px * var(--font-scale));font-weight:500;color:#393b37;letter-spacing:1px}
.hint-bar{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);font-size:calc(13px * var(--font-scale));color:#777a74;z-index:100}

${postcardDisplayStyles}
:root{color-scheme:light;--page-bg:#f1f0ec;--page-title:#393b37;--page-hint:#777a74}
body{background:var(--page-bg)}
.title-bar h1{color:var(--page-title)}
.hint-bar{color:var(--page-hint)}
body[data-color-mode="dark"]{color-scheme:dark;--page-bg:#202326;--page-title:#eee9df;--page-hint:#c3bbb0}
@media(prefers-color-scheme:dark){body[data-color-mode="system"]{color-scheme:dark;--page-bg:#202326;--page-title:#eee9df;--page-hint:#c3bbb0}}
.mail-stage,.flip-scene,.letter-sheet-frame{margin-block:auto}
.mail-stage{width:min(88vw,720px);height:min(56vw,450px);min-height:230px;flex:0 0 auto}
.flip-scene{width:min(88vw,720px)}
.letter-paper{padding:clamp(16px,4vw,40px) clamp(18px,4.5vw,44px)}
.letter-sheet-frame{width:min(92vw,900px)}
${letterWidthRule}
@media(max-width:600px){.mail-stage{width:94vw;height:min(58vw,340px)}.flip-scene{width:94vw}.card-back{padding:clamp(14px,5vw,24px)}}
</style>
</head>
<body data-color-mode="${props.exportColorMode ?? "system"}">
${titleBar}
${stageHTML}
<script>
${script}
<\/script>
</body>
</html>`;
}

const exportBusy = ref(false);

async function exportHTML() {
  exportBusy.value = true;
  const html = generateHTML();
  const fileName = `postcard-${form.id.slice(0, 8)}.html`;

  invoke("save_postcard", {
    fileName,
    content: html,
    exportDirectory: props.exportDirectory || null,
  }).then(() => {
    emit("export", { ...form });
  }).catch(err => {
    console.error("Export failed:", err);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    emit("export", { ...form });
  }).finally(() => {
    exportBusy.value = false;
  });
}

const {
  systemFontList,
  isLoading: isFontLoading,
  fontSource,
  fontLoadError,
  refreshSystemFonts,
} = useSystemFonts();
const preservedFontOptions = ref<string[]>([]);
const fontOptions = computed(() => [
  ...new Set([
    ...DEFAULT_FONT_FAMILIES,
    ...systemFontList.value,
    ...preservedFontOptions.value,
  ]),
]
  .filter((font) => font !== SYSTEM_DEFAULT_FONT)
  .sort((a, b) => a.localeCompare(b)));
const fontStatus = computed(() => {
  if (isFontLoading.value) return "正在读取本机字体…";
  if (fontLoadError.value) return fontLoadError.value;
  const sourceLabel = {
    native: "本机字体",
    browser: "浏览器可访问字体",
    canvas: "浏览器检测字体",
    cache: "缓存字体",
    fallback: "常用字体",
  }[fontSource.value];
  return `已获取 ${systemFontList.value.length} 种${sourceLabel}`;
});

function activateEditorEntry() {
  if (props.entryMode === "history") {
    loadSelectedCard();
  } else if (props.entryMode === "template" && props.initialTemplate) {
    applyTemplate(props.initialTemplate);
  } else {
    resetForm();
  }
  rememberFonts(
    form.titleFont,
    form.messageFont,
    form.captionFont,
    form.backCaptionFont,
    form.fromFont,
    form.toFont,
    form.stampFont,
  );
}

watch(() => props.editorSessionId, activateEditorEntry);

onMounted(() => {
  loadHistory();
  activateEditorEntry();
  void nextTick(syncRichEditors);
  document.addEventListener("selectionchange", refreshRichFormatting);
});

onBeforeUnmount(() => {
  stopPreviewResize();
  endStickerInteraction();
  window.clearTimeout(envelopeTransitionTimer);
  document.removeEventListener("selectionchange", refreshRichFormatting);
});
onDeactivated(() => {
  stopPreviewResize();
  endStickerInteraction();
});
</script>

<template>
  <div ref="editorElement" class="editor" :class="{ 'resizing-preview': isResizingPreview }" :style="{ '--preview-width': `${previewWidth}%` }">
    <div class="editor-body">
      <section class="form-section">
        <header class="section-heading">
          <h2>内容</h2>
          <p>选择载体并编辑要寄出的文字或图片。</p>
        </header>

        <div class="form-grid">
          <div class="field">
            <label>类型</label>
            <select v-model="form.type" @change="onTypeChange">
              <option value="envelope">信封</option>
              <option value="postcard">明信片</option>
              <option value="letter">信纸</option>
            </select>
          </div>
          <div class="field">
            <label>标题 ({{ form.title.length }}/{{ MAX.title }})</label>
            <input v-model="form.title" :maxlength="MAX.title" />
          </div>
          <div class="field field-wide">
            <label>备注（可选）</label>
            <textarea v-model="form.note" rows="2" placeholder="给这封信加备注，例如：给妈妈的节日祝福"></textarea>
          </div>
          <div v-if="form.type === 'envelope' || form.type === 'letter'" class="field field-wide">
            <label>{{ form.type === 'letter' ? '信纸正文' : '信纸内容' }}（{{ form.message.length }} 字）</label>
            <div class="rich-toolbar" role="toolbar" aria-label="正文格式">
              <button type="button" aria-label="加粗" title="加粗" :class="{ active: activeRichFormats.bold }" :aria-pressed="activeRichFormats.bold" @mousedown.prevent @click="formatRichText('message', 'bold')"><strong>B</strong></button>
              <button type="button" aria-label="斜体" title="斜体" :class="{ active: activeRichFormats.italic }" :aria-pressed="activeRichFormats.italic" @mousedown.prevent @click="formatRichText('message', 'italic')"><em>I</em></button>
              <button type="button" aria-label="下划线" title="下划线" :class="{ active: activeRichFormats.underline }" :aria-pressed="activeRichFormats.underline" @mousedown.prevent @click="formatRichText('message', 'underline')"><u>U</u></button>
              <button type="button" aria-label="项目符号列表" title="项目符号列表" :class="{ active: activeRichFormats.unorderedList }" :aria-pressed="activeRichFormats.unorderedList" @mousedown.prevent @click="formatRichText('message', 'insertUnorderedList')">• 列表</button>
              <button type="button" aria-label="编号列表" title="编号列表" :class="{ active: activeRichFormats.orderedList }" :aria-pressed="activeRichFormats.orderedList" @mousedown.prevent @click="formatRichText('message', 'insertOrderedList')">1. 列表</button>
              <button type="button" aria-label="清除格式" title="清除选中文本的格式" @mousedown.prevent @click="clearRichFormatting('message')">清除格式</button>
            </div>
            <div
              ref="messageEditor"
              class="rich-editor rich-text-body"
              contenteditable="true"
              role="textbox"
              aria-label="信纸正文"
              aria-multiline="true"
              data-placeholder="在这里写下信件内容…"
              @input="onRichTextInput('message', $event)"
              @focus="setActiveRichEditor"
              @keyup="refreshRichFormatting"
              @mouseup="refreshRichFormatting"
            ></div>
            <div v-if="form.type === 'letter'" class="sticker-tools">
              <label class="btn-secondary">
                上传信纸贴纸
                <input type="file" accept="image/*" multiple hidden @change="uploadStickers" />
              </label>
              <span>贴纸可拖动；选中后用角点缩放、上方控制点旋转。</span>
            </div>
          </div>
          <div v-if="form.type === 'postcard'" class="field field-wide">
            <label>明信片图片</label>
            <div class="image-row">
              <label class="btn-secondary">
                上传图片
                <input type="file" accept="image/*" @change="onCardImage" hidden />
              </label>
              <button v-if="form.cardImage" class="btn-secondary" @click="clearCardImage">清除图片</button>
            </div>
            <img v-if="form.cardImage" :src="form.cardImage" class="image-preview" alt="" />
          </div>
          <div v-if="form.type === 'postcard'" class="field">
            <label>正面文字 ({{ form.caption.length }}/{{ MAX.caption }})</label>
            <input v-model="form.caption" :maxlength="MAX.caption" />
          </div>
          <div v-if="form.type === 'postcard'" class="field field-wide">
            <label>背面文字（{{ form.backCaption.length }} 字）</label>
            <div class="rich-toolbar" role="toolbar" aria-label="背面文字格式">
              <button type="button" aria-label="加粗" title="加粗" :class="{ active: activeRichFormats.bold }" :aria-pressed="activeRichFormats.bold" @mousedown.prevent @click="formatRichText('backCaption', 'bold')"><strong>B</strong></button>
              <button type="button" aria-label="斜体" title="斜体" :class="{ active: activeRichFormats.italic }" :aria-pressed="activeRichFormats.italic" @mousedown.prevent @click="formatRichText('backCaption', 'italic')"><em>I</em></button>
              <button type="button" aria-label="下划线" title="下划线" :class="{ active: activeRichFormats.underline }" :aria-pressed="activeRichFormats.underline" @mousedown.prevent @click="formatRichText('backCaption', 'underline')"><u>U</u></button>
              <button type="button" aria-label="项目符号列表" title="项目符号列表" :class="{ active: activeRichFormats.unorderedList }" :aria-pressed="activeRichFormats.unorderedList" @mousedown.prevent @click="formatRichText('backCaption', 'insertUnorderedList')">• 列表</button>
              <button type="button" aria-label="编号列表" title="编号列表" :class="{ active: activeRichFormats.orderedList }" :aria-pressed="activeRichFormats.orderedList" @mousedown.prevent @click="formatRichText('backCaption', 'insertOrderedList')">1. 列表</button>
              <button type="button" aria-label="清除格式" title="清除选中文本的格式" @mousedown.prevent @click="clearRichFormatting('backCaption')">清除格式</button>
            </div>
            <div
              ref="backCaptionEditor"
              class="rich-editor rich-text-body"
              contenteditable="true"
              role="textbox"
              aria-label="明信片背面文字"
              aria-multiline="true"
              data-placeholder="翻面后在这里写…"
              @input="onRichTextInput('backCaption', $event)"
              @focus="setActiveRichEditor"
              @keyup="refreshRichFormatting"
              @mouseup="refreshRichFormatting"
            ></div>
          </div>
        </div>
      </section>

      <section class="form-section">
        <header class="section-heading">
          <h2>排版</h2>
          <p>字体只从本机读取，不会上传到网络。</p>
        </header>
        <div class="font-status-row">
          <p class="font-status" :class="{ 'font-status-error': fontLoadError }" role="status" aria-live="polite">{{ fontStatus }}</p>
          <button class="font-refresh" type="button" :disabled="isFontLoading" @click="refreshSystemFonts">
            {{ isFontLoading ? "读取中…" : "刷新字体" }}
          </button>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>标题字体</label>
            <FontSelect v-model="form.titleFont" :fonts="fontOptions" />
          </div>
          <div class="field">
            <label>{{ form.type === 'postcard' ? '正面文字字体' : '正文/信纸字体' }}</label>
            <FontSelect v-if="form.type === 'postcard'" v-model="form.captionFont" :fonts="fontOptions" />
            <FontSelect v-else v-model="form.messageFont" :fonts="fontOptions" />
          </div>
          <div v-if="form.type === 'postcard'" class="field">
            <label>背面文字字体</label>
            <FontSelect v-model="form.backCaptionFont" :fonts="fontOptions" />
          </div>
          <div class="field">
            <label>信件内容字号：{{ form.fontSize }}px</label>
            <input type="range" min="14" max="36" v-model.number="form.fontSize" />
          </div>
          <div v-if="form.type !== 'letter'" class="field">
            <label>寄件人字体</label>
            <FontSelect v-model="form.fromFont" :fonts="fontOptions" />
          </div>
          <div v-if="form.type !== 'letter'" class="field">
            <label>收件人字体</label>
            <FontSelect v-model="form.toFont" :fonts="fontOptions" />
          </div>
          <div v-if="form.type !== 'letter'" class="field">
            <label>邮票字体</label>
            <FontSelect v-model="form.stampFont" :fonts="fontOptions" />
          </div>
        </div>
      </section>

      <section v-if="form.type !== 'letter'" class="form-section">
        <header class="section-heading">
          <h2>邮寄信息</h2>
          <p>设置收件人与邮票样式。</p>
        </header>
        <div class="form-grid">
          <div class="field">
            <label>寄件人 ({{ form.from.length }}/{{ MAX.from }})</label>
            <input v-model="form.from" :maxlength="MAX.from" />
          </div>
          <div class="field">
            <label>收件人 ({{ form.to.length }}/{{ MAX.to }})</label>
            <input v-model="form.to" :maxlength="MAX.to" />
          </div>
          <div class="field">
            <label>邮票文字 ({{ form.stampText.length }}/{{ MAX.stampText }})</label>
            <input v-model="form.stampText" :maxlength="MAX.stampText" placeholder="邮票文字" />
          </div>
          <div class="field">
            <label>邮票图片</label>
            <div class="image-row">
              <label class="btn-secondary">
                选择图片
                <input type="file" accept="image/*" @change="onStampImage" hidden />
              </label>
              <button v-if="form.stampImage" class="btn-secondary" @click="clearStampImage">移除</button>
            </div>
            <div v-if="form.stampImage" class="stamp-preview">
              <img :src="form.stampImage" alt="" />
            </div>
          </div>
        </div>
      </section>

      <section class="form-section">
        <header class="section-heading">
          <h2>外观</h2>
          <p>调整信纸或明信片的颜色与边框。</p>
        </header>
        <div class="form-grid">
          <div class="field">
            <label>背景色</label>
            <input type="color" v-model="form.bgColor" />
          </div>
          <div class="field">
            <label>文字颜色</label>
            <input type="color" v-model="form.textColor" />
          </div>
          <div class="field">
            <label>边框样式</label>
            <select v-model="form.borderStyle">
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
              <option value="double">双线</option>
              <option value="dotted">点线</option>
            </select>
          </div>
          <div class="field">
            <label>边框颜色</label>
            <input type="color" v-model="form.borderColor" />
          </div>
        </div>
      </section>

      <div class="actions">
        <button class="btn-primary" @click="handleSave">保存</button>
        <button class="btn-secondary" @click="resetForm">重置</button>
        <button class="btn-primary" @click="exportHTML" :disabled="exportBusy">{{ exportBusy ? "正在导出…" : "导出 HTML" }}</button>
      </div>
    </div>

    <div class="preview-section">
      <div class="preview-heading">
        <h3>预览 <span>· {{ form.type === 'envelope' ? (!isOpened ? '点击打开信封' : !isExpanded ? '再次点击抽出信纸' : '点击收起信纸') : form.type === 'postcard' ? '点击明信片翻面' : '单面信纸' }}</span></h3>
        <span class="resize-label">拖动调整大小</span>
      </div>
      <div
        class="preview-resize-handle"
        role="separator"
        aria-label="拖动调整预览窗口大小"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(previewWidth)"
        aria-valuemin="34"
        aria-valuemax="68"
        tabindex="0"
        @pointerdown="startPreviewResize"
        @keydown="adjustPreviewWidth"
      >
        <span aria-hidden="true"></span>
      </div>

      <!-- 信封模式 -->
      <div v-if="form.type === 'envelope'" class="mail-stage" :class="{ opened: isOpened, expanded: isExpanded }" :style="{ '--font-scale': form.fontSize / 18 }" @click="handleStageClick">
        <div class="letter-mask">
          <div class="letter-paper">
              <div class="paper-lines rich-text-body" :style="{ fontFamily: form.messageFont }" v-html="safeMessageHtml"></div>
              <div class="paper-footer" :style="{ fontFamily: form.fromFont }">
              <span>{{ form.from.replace('来自：', '') }}</span>
              <span>{{ form.to.replace('致：', '') }}</span>
            </div>
          </div>
        </div>
        <div class="mail-base">
          <div class="envelope-body">
            <div class="stamp-box" :style="{ fontFamily: form.stampFont }">
              <img v-if="form.stampImage" :src="form.stampImage" alt="" />
              <span v-else class="stamp-text">{{ form.stampText }}</span>
            </div>
            <div class="address-area" :style="{ fontFamily: form.toFont }">
              <span class="to-label">TO:</span>
              <span class="name-text">{{ form.to.replace('致：', '') }}</span>
            </div>
          </div>
          <div class="envelope-flap"></div>
        </div>
      </div>

      <div v-else-if="form.type === 'letter'" class="letter-sheet-frame" :style="{ '--font-scale': form.fontSize / 18 }">
        <article
          ref="letterCanvas"
          class="letter-sheet"
          :style="{ backgroundColor: form.bgColor, color: form.textColor, fontFamily: form.messageFont, fontSize: form.fontSize + 'px', border: '1px ' + form.borderStyle + ' ' + form.borderColor }"
        >
          <h1 :style="{ fontFamily: form.titleFont }">{{ form.title }}</h1>
          <div class="letter-sheet-content rich-text-body" v-html="safeMessageHtml"></div>
          <div
          v-for="sticker in form.stickers ?? []"
          :key="sticker.id"
          class="letter-sticker-item"
          :class="{ selected: selectedStickerId === sticker.id }"
          :data-sticker-id="sticker.id"
          :style="{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            width: `${sticker.width}%`,
            aspectRatio: sticker.aspectRatio,
            transform: `rotate(${sticker.rotation}deg)`,
          }"
          tabindex="0"
          :aria-label="`信纸贴纸，位置 ${Math.round(sticker.x)}%，大小 ${Math.round(sticker.width)}%，旋转 ${Math.round(sticker.rotation)} 度`"
          @pointerdown="beginStickerInteraction('move', sticker, $event)"
          @click.stop="selectedStickerId = sticker.id"
          @keydown.delete.prevent="removeSticker(sticker.id)"
          >
            <img :src="sticker.src" alt="" draggable="false" @load="updateStickerAspect(sticker, $event)" />
            <template v-if="selectedStickerId === sticker.id">
              <button
              class="sticker-control sticker-rotate"
              type="button"
              aria-label="旋转贴纸"
              title="拖动旋转"
              @pointerdown.stop="beginStickerInteraction('rotate', sticker, $event)"
              >↻</button>
              <button
              class="sticker-control sticker-resize"
              type="button"
              aria-label="调整贴纸大小"
              title="拖动缩放"
              @pointerdown.stop="beginStickerInteraction('resize', sticker, $event)"
              ></button>
              <button
              class="sticker-control sticker-remove"
              type="button"
              aria-label="移除贴纸"
              title="移除贴纸"
              @pointerdown.stop
              @click.stop="removeSticker(sticker.id)"
              >×</button>
            </template>
          </div>
        </article>
      </div>

      <!-- 明信片模式 -->
      <div v-else-if="form.type === 'postcard'" class="flip-scene" :style="{ '--font-scale': form.fontSize / 18 }" @click="handleStageClick">
        <div class="flip-card" :class="{ flipped: isFlipped }">
          <div class="flip-face flip-front">
            <div class="card-image-frame">
              <div class="card-image-wrap">
                <img v-if="form.cardImage" :src="form.cardImage" alt="" />
                <div v-else class="image-placeholder">点击上传图片</div>
              </div>
            </div>
            <div class="card-caption-front">
              <span class="caption-text" :style="{ fontFamily: form.captionFont }">{{ form.caption }}</span>
            </div>
          </div>
          <div class="flip-face flip-back"
            :style="{ backgroundColor: form.bgColor, color: form.textColor, fontSize: form.fontSize + 'px', border: '1px ' + form.borderStyle + ' ' + form.borderColor }">
            <div class="card-back">
              <div class="card-writing-area" :style="{ fontFamily: form.backCaptionFont, '--writing-paper': form.bgColor }" @click.stop>
                <div class="card-stamp-box" :style="{ borderColor: form.borderColor, fontFamily: form.stampFont }" contenteditable="false">
                  <img v-if="form.stampImage" :src="form.stampImage" alt="" />
                  <span v-else>{{ form.stampText }}</span>
                </div>
                <div
                  class="writing-copy"
                  v-html="safeBackCaptionHtml"
                  @click.stop
                ></div>
              </div>
              <div class="card-footer" :style="{ fontFamily: form.fromFont }">
                <span class="card-from">{{ form.from }}</span>
                <span class="card-to">{{ form.to }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="toolbar-bottom">
        <button v-if="form.type === 'envelope'" @click="isOpened ? resetMail() : handleStageClick()">{{ isOpened ? '重新封装' : '打开信纸' }}</button>
      </div>

      <footer class="hint-bar">
        <span v-if="form.type === 'envelope'">
          <span v-if="!isOpened">点击信封或按钮打开信封</span>
          <span v-else-if="!isExpanded">信封已打开，再次点击抽出信纸</span>
          <span v-else>点击信纸将其放回并合上信封</span>
        </span>
        <span v-else-if="form.type === 'postcard'">
          <span v-if="!isFlipped">点击明信片翻面查看文字</span>
          <span v-else>点击明信片翻回图片</span>
        </span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 20px 20px;
  background: #faf9f6;
  border: 1px solid #d8d5d1;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.form-section {
  padding: 20px 0;
  border-bottom: 1px solid #e7e6e1;
}

.section-heading {
  margin-bottom: 14px;
}

.section-heading h2 {
  margin: 0;
  color: #3d3f3a;
  font-size: 1.0714em;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.section-heading p {
  margin: 4px 0 0;
  color: #898b84;
  font-size: 0.8571em;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.field-wide {
  grid-column: 1 / -1;
}

.font-status {
  margin: 0;
  color: #7b7e76;
  font-size: 0.8571em;
}

.font-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -4px 0 14px;
}

.font-status-error {
  color: #7a6553;
}

.font-refresh {
  flex: 0 0 auto;
  padding: 4px 9px;
  border: 1px solid #d1d0ca;
  border-radius: 3px;
  background: transparent;
  color: #4c4e49;
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
}

.font-refresh:disabled {
  cursor: wait;
  opacity: 0.55;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 0.9286em;
  font-weight: 600;
  color: #565852;
}

.field input,
.field textarea,
.field select {
  padding: 8px;
  border: 1px solid #d8d7d1;
  border-radius: 3px;
  font-size: 1em;
  font-family: inherit;
  color: #373934;
  background: #fdfcf9;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  outline: none;
  border-color: #92958d;
  box-shadow: 0 0 0 2px rgba(102, 106, 97, 0.1);
}

.field textarea {
  resize: vertical;
}

.preset-panel {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-header {
  font-size: 0.8571em;
  color: #777b72;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-btn {
  padding: 8px 12px;
  border: 1px solid #d7d5cf;
  border-radius: 999px;
  background: #f5f3ee;
  color: #3d403b;
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.preset-btn:hover {
  transform: translateY(-1px);
  border-color: #b8b6af;
}

.preset-btn.muted {
  background: #f9f8f4;
}

.image-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.image-preview {
  max-width: 200px;
  max-height: 140px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid #d8d7d1;
}

.stamp-preview {
  width: 52px;
  height: 60px;
  border: 1px dashed #c6c6bf;
  border-radius: 2px;
  overflow: hidden;
}

.stamp-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9e8e3;
  color: #858780;
  font-size: 1.0714em;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 8px 16px;
  border: 1px solid #4f564f;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  background: #4f564f;
  color: #fff;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.btn-primary:hover {
  background: #454b45;
  border-color: #3d423d;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #c7c4be;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  background: #f5f4f2;
  color: #4c4e49;
  display: inline-flex;
  align-items: center;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.btn-secondary:hover {
  background: #efeee9;
  border-color: #b8b4af;
}

.danger {
  background: #777a73;
  color: #fff;
  padding: 4px 10px;
  font-size: 0.8571em;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.preview-section {
  margin-top: 8px;
}

.preview-section h3 {
  margin-bottom: 12px;
  color: #565852;
  font-family: Georgia, "Noto Serif SC", serif;
  font-weight: 600;
}

.toolbar-bottom {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 12px;
}

.toolbar-bottom button {
  padding: 6px 18px;
  border: 1px solid #bbb;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 0.9286em;
  color: #4c4e49;
}

.hint-bar {
  font-size: 0.9286em;
  opacity: 0.5;
  text-align: center;
  margin-top: 8px;
  color: #777a74;
}

.history-list {
  padding: 16px;
  background: #faf9f6;
  border: 1px solid #deddd7;
  border-radius: 0 4px 4px 4px;
  box-shadow: 0 6px 18px rgba(38, 40, 36, 0.045);
}

.empty {
  color: #999;
  text-align: center;
  padding: 24px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-info span {
  font-size: 0.9286em;
  color: #666;
}

.history-info small {
  font-size: 0.7857em;
  color: #aaa;
}

.history-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

@media (prefers-color-scheme: dark) {
  .hint-bar {
    color: #aaa;
  }

  .toolbar-bottom button {
    color: #d3ceca;
  }
}

@media (max-width: 600px) {
  .editor {
    gap: 12px;
  }

  .editor-body {
    padding: 14px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: auto;
  }

}

.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(330px, var(--preview-width, 46%));
  align-items: start;
  gap: 18px;
  max-width: none;
  margin: 0;
  color: var(--text);
  container-type: inline-size;
}

.editor-body {
  min-width: 0;
  padding: 4px 22px 20px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface);
  box-shadow: none;
}

.form-section {
  padding: 19px 0;
  border-color: var(--border);
}

.section-heading h2 {
  color: var(--text);
  font-size: 1.0714em;
  letter-spacing: 0;
}

.section-heading p,
.font-status,
.preset-header,
.font-refresh {
  color: var(--muted);
}

.font-status-error {
  color: #ad4828;
}

.font-refresh {
  padding: 5px 9px;
  border-color: var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
}

.font-refresh:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.field label {
  color: var(--muted);
  font-size: 0.8571em;
  font-weight: 600;
}

.field input,
.field textarea,
.field select {
  min-height: 36px;
  padding: 8px 10px;
  border-color: var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.9286em;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.field textarea {
  min-height: auto;
}

.rich-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rich-toolbar button {
  min-width: 32px;
  min-height: 30px;
  padding: 4px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
}

.rich-toolbar button:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.rich-editor {
  min-height: 220px;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.9286em;
  line-height: 1.8;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.rich-editor:focus {
  outline: 1px solid var(--accent);
  border-color: var(--accent);
}

.rich-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--muted);
  pointer-events: none;
}

.rich-editor p,
.rich-editor div {
  margin: 0 0 0.65em;
}

.rich-editor ul,
.rich-editor ol {
  margin: 0 0 0.65em 1.5em;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.preset-panel {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--border);
  background: var(--surface-alt);
}

.preset-header {
  font-size: 0.7857em;
  letter-spacing: 0.04em;
}

.preset-btn {
  padding: 6px 10px;
  border-color: var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8571em;
}

.preset-btn:hover {
  transform: none;
  border-color: var(--accent);
  background: var(--accent-tint);
}

.preset-btn.muted {
  background: var(--surface);
}

.image-row {
  min-height: 36px;
}

.image-preview,
.stamp-preview {
  border-color: var(--border);
  border-radius: 2px;
}

.image-placeholder {
  background: var(--surface-alt);
  color: var(--muted);
}

.actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin: 0 -22px -20px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.btn-primary,
.btn-secondary {
  min-height: 36px;
  padding: 7px 15px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  font: inherit;
  font-size: 0.9286em;
  font-weight: 600;
}

.btn-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.btn-primary:hover {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: wait;
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
}

.btn-secondary:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.preview-section {
  position: relative;
  position: sticky;
  top: 18px;
  min-width: 0;
  margin: 0;
  padding: 18px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.preview-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.resize-label {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 0.7143em;
}

.preview-resize-handle {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: -7px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 84px;
  transform: translateY(-50%);
  cursor: col-resize;
  touch-action: none;
}

.preview-resize-handle span {
  width: 4px;
  height: 46px;
  border-radius: 4px;
  background: var(--border-strong);
}

.preview-resize-handle:hover span,
.preview-resize-handle:focus-visible span {
  background: var(--accent);
}

.preview-resize-handle:focus-visible {
  outline: 1px solid var(--accent);
}

.resizing-preview,
.resizing-preview * {
  cursor: col-resize !important;
  user-select: none !important;
}

.resizing-preview .preview-resize-handle span {
  background: var(--accent);
}

.preview-section :deep(.flip-scene),
.preview-section :deep(.mail-stage) {
  width: 100%;
  max-width: none;
  height: auto;
  aspect-ratio: 8 / 5;
  box-sizing: border-box;
}

.preview-section :deep(.mail-stage.expanded) {
  height: auto;
  aspect-ratio: 8 / 5;
}

.preview-section :deep(.mail-stage.expanded .letter-mask) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translateY(-70px);
  width: calc(100% - 32px);
  max-width: calc(100% - 32px);
  height: auto;
  min-height: 320px;
  overflow: visible;
  margin: 0;
}

.preview-section :deep(.mail-stage.expanded .letter-paper) {
  height: auto;
  min-height: 320px;
}

.preview-section :deep(.mail-stage.expanded .paper-lines) {
  flex: 1 0 auto;
}

.preview-section :deep(.letter-sticker-item) {
  position: absolute;
  z-index: auto;
  display: block;
  transform-origin: center;
  cursor: move;
  touch-action: none;
}

.preview-section :deep(.letter-sheet-frame) {
  width: 100%;
}

.preview-section :deep(.letter-sticker-item img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.preview-section :deep(.letter-sticker-item.selected) {
  z-index: auto;
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}

.sticker-control {
  position: absolute;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--accent);
  border-radius: 50%;
  background: var(--surface);
  color: var(--accent);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  touch-action: none;
}

.sticker-resize {
  right: -12px;
  bottom: -12px;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  cursor: nwse-resize;
}

.sticker-rotate {
  top: -34px;
  left: calc(50% - 12px);
  cursor: grab;
}

.sticker-remove {
  top: -12px;
  right: -12px;
  background: #a52822;
  border-color: #a52822;
  color: #fff;
}

.rich-toolbar button.active {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.sticker-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.sticker-tools > span {
  color: var(--muted);
  font-size: 0.7857em;
}

.preview-section h3 {
  margin: 0 0 16px;
  color: var(--text);
  font-family: inherit;
  font-size: 1em;
  font-weight: 600;
}

.preview-section h3 span {
  color: var(--muted);
  font-size: 0.8571em;
  font-weight: 400;
}

.hint-bar {
  color: var(--muted);
  opacity: 1;
}

.toolbar-bottom button {
  border-color: var(--border-strong);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
}

.toolbar-bottom button:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.danger {
  background: #a33a32;
}

@media (max-width: 900px) {
  .editor {
    grid-template-columns: 1fr;
  }

  .preview-section {
    position: static;
  }

  .preview-resize-handle,
  .resize-label {
    display: none;
  }
}

@media (max-width: 600px) {
  .editor-body {
    padding: 4px 14px 16px;
  }

  .actions {
    margin: 0 -14px -16px;
    padding: 12px 14px;
  }

  .preview-section {
    padding: 14px;
  }
}

@container (max-width: 760px) {
  .editor-body,
  .preview-section {
    grid-column: 1 / -1;
  }

  .preview-section {
    position: static;
  }

  .preview-resize-handle,
  .resize-label {
    display: none;
  }
}

@container (max-width: 540px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .field-wide {
    grid-column: auto;
  }

  .editor-body {
    padding-right: 14px;
    padding-left: 14px;
  }

  .actions {
    margin-right: -14px;
    margin-left: -14px;
    padding-right: 14px;
    padding-left: 14px;
  }
}

</style>