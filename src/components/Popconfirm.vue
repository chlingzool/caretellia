<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { t } from "../i18n";

defineProps<{
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  (event: "confirm"): void;
}>();

const panelId = `popconfirm-${crypto.randomUUID()}`;
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);
const isOpen = ref(false);
const isMobile = ref(window.matchMedia("(max-width: 640px)").matches);
const triggerAttributes = computed(() => ({
  "data-popconfirm-trigger": "",
  "aria-haspopup": "dialog" as const,
  "aria-expanded": isOpen.value,
  "aria-controls": isOpen.value ? panelId : undefined,
}));
const panelPosition = ref({ left: "12px", top: "12px" });
const panelAbove = ref(false);
let restoreFocus = true;
let previousOverflow = "";
let dragStartY: number | null = null;
const dragOffset = ref(0);
const isDragging = ref(false);

function updateViewport() {
  const wasMobile = isMobile.value;
  isMobile.value = window.matchMedia("(max-width: 640px)").matches;
  if (isOpen.value && wasMobile !== isMobile.value) {
    document.body.style.overflow = isMobile.value ? "hidden" : previousOverflow;
  }
  if (isOpen.value) void nextTick(positionPanel);
}

function positionPanel() {
  if (isMobile.value || !root.value || !panel.value) return;
  const trigger = root.value.querySelector<HTMLElement>("[data-popconfirm-trigger]");
  if (!trigger) return;

  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.value.getBoundingClientRect();
  const margin = 12;
  const left = Math.max(margin, Math.min(
    triggerRect.left,
    window.innerWidth - panelRect.width - margin,
  ));
  const below = triggerRect.bottom + 8;
  panelAbove.value = below + panelRect.height > window.innerHeight - margin;
  const top = panelAbove.value
    ? Math.max(margin, triggerRect.top - panelRect.height - 8)
    : below;
  panelPosition.value = { left: `${left}px`, top: `${top}px` };
}

async function open(event?: MouseEvent) {
  isOpen.value = true;
  restoreFocus = !(event && "pointerType" in event && event.pointerType === "touch");
  previousOverflow = document.body.style.overflow;
  if (isMobile.value) document.body.style.overflow = "hidden";
  await nextTick();
  positionPanel();
  if (restoreFocus) cancelButton.value?.focus();
  else panel.value?.focus();
}

function close(shouldRestoreFocus = true) {
  isOpen.value = false;
  dragOffset.value = 0;
  isDragging.value = false;
  if (isMobile.value) document.body.style.overflow = previousOverflow;
  if (shouldRestoreFocus && restoreFocus) {
    void nextTick(() => root.value?.querySelector<HTMLElement>("[data-popconfirm-trigger]")?.focus());
  } else if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function toggle(event: MouseEvent) {
  if (isOpen.value) close();
  else void open(event);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Node)) return;
  if (isMobile.value) return;
  if (!root.value?.contains(event.target) && !panel.value?.contains(event.target)) close(false);
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "Tab" && isMobile.value) {
    if (event.shiftKey && (document.activeElement === cancelButton.value || document.activeElement === panel.value)) {
      event.preventDefault();
      confirmButton.value?.focus();
    } else if (!event.shiftKey && (document.activeElement === confirmButton.value || document.activeElement === panel.value)) {
      event.preventDefault();
      cancelButton.value?.focus();
    }
  }
}

function confirm() {
  close(false);
  emit("confirm");
}

function startSheetDrag(event: PointerEvent) {
  if (!isMobile.value) return;
  dragStartY = event.clientY;
  dragOffset.value = 0;
  isDragging.value = true;
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

function moveSheetDrag(event: PointerEvent) {
  if (dragStartY !== null) dragOffset.value = Math.max(0, event.clientY - dragStartY);
}

function endSheetDrag(event: PointerEvent) {
  if (dragStartY === null) return;
  const shouldDismiss = event.clientY - dragStartY > 72;
  dragStartY = null;
  dragOffset.value = 0;
  isDragging.value = false;
  if (shouldDismiss) close(false);
}

watch(isOpen, (openState) => {
  if (openState) {
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeydown);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("scroll", positionPanel, true);
  } else {
    document.removeEventListener("pointerdown", onDocumentPointerDown);
    document.removeEventListener("keydown", onDocumentKeydown);
    window.removeEventListener("resize", updateViewport);
    window.removeEventListener("scroll", positionPanel, true);
  }
});

onBeforeUnmount(() => {
  if (isMobile.value) document.body.style.overflow = previousOverflow;
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
  window.removeEventListener("resize", updateViewport);
  window.removeEventListener("scroll", positionPanel, true);
});
</script>

<template>
  <span ref="root" class="popconfirm-root">
    <slot
      name="trigger"
      :open="isOpen"
      :toggle="toggle"
      :panel-id="panelId"
      :trigger-attributes="triggerAttributes"
    />
    <Teleport to=".app-shell">
      <Transition name="popconfirm">
        <div v-if="isOpen" class="popconfirm-layer">
          <section
            :id="panelId"
            ref="panel"
            class="popconfirm-panel"
            :class="{ 'is-mobile-sheet': isMobile, 'is-danger': danger, 'is-above': panelAbove, 'is-dragging': isDragging }"
            :style="isMobile
              ? (dragOffset ? { transform: `translateY(${dragOffset}px)` } : {})
              : panelPosition"
            role="alertdialog"
            :aria-modal="isMobile"
            :aria-labelledby="`${panelId}-title`"
            :aria-describedby="`${panelId}-message`"
            tabindex="-1"
          >
            <span
              v-if="isMobile"
              class="popconfirm-handle"
              aria-hidden="true"
              @pointerdown="startSheetDrag"
              @pointermove="moveSheetDrag"
              @pointerup="endSheetDrag"
              @pointercancel="endSheetDrag"
            ></span>
            <h2 :id="`${panelId}-title`">{{ title }}</h2>
            <p :id="`${panelId}-message`">{{ message }}</p>
            <div class="popconfirm-actions">
              <button ref="cancelButton" class="popconfirm-cancel" type="button" @click="close()">
                {{ cancelLabel ?? t("取消", "Cancel") }}
              </button>
              <button ref="confirmButton" class="popconfirm-confirm" type="button" @click="confirm">
                {{ confirmLabel ?? t("确定", "Confirm") }}
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style>
.popconfirm-layer {
  position: fixed;
  z-index: 210;
  inset: 0;
  pointer-events: none;
}

.popconfirm-root {
  display: inline-flex;
  flex: 0 0 auto;
}

.popconfirm-panel {
  position: fixed;
  width: min(300px, calc(100vw - 24px));
  padding: 16px;
  border: 1px solid var(--border, #d2d8de);
  border-radius: 5px;
  background: var(--surface, #fff);
  color: var(--text, #25282b);
  box-shadow: 0 12px 32px rgb(0 0 0 / 20%);
  pointer-events: auto;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
}

.popconfirm-panel:not(.is-mobile-sheet)::before {
  position: absolute;
  top: -5px;
  left: 18px;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--border, #d2d8de);
  border-left: 1px solid var(--border, #d2d8de);
  background: var(--surface, #fff);
  content: "";
  transform: rotate(45deg);
}

.popconfirm-panel.is-above:not(.is-mobile-sheet)::before {
  top: auto;
  bottom: -5px;
  border: 0;
  border-right: 1px solid var(--border, #d2d8de);
  border-bottom: 1px solid var(--border, #d2d8de);
}

.popconfirm-panel h2 {
  margin: 0;
  font-size: 1em;
  font-weight: 650;
}

.popconfirm-panel p {
  margin: 7px 0 0;
  color: var(--muted, #68727b);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.popconfirm-panel:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 2px;
}

.popconfirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.popconfirm-actions button {
  min-height: 40px;
  padding: 7px 12px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 3px;
  background: var(--surface, #fff);
  color: var(--text, #25282b);
  font: inherit;
  cursor: pointer;
}

.popconfirm-actions button:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 2px;
}

.popconfirm-actions .popconfirm-confirm {
  border-color: var(--accent, #4aa8f4);
  background: var(--accent, #4aa8f4);
  color: #fff;
}

.popconfirm-panel.is-danger .popconfirm-confirm {
  border-color: #c84840;
  background: #c84840;
}

.popconfirm-enter-active,
.popconfirm-leave-active {
  transition: opacity 0.14s ease;
}

.popconfirm-enter-active .popconfirm-panel,
.popconfirm-leave-active .popconfirm-panel {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.popconfirm-enter-from,
.popconfirm-leave-to {
  opacity: 0;
}

.popconfirm-enter-from .popconfirm-panel,
.popconfirm-leave-to .popconfirm-panel {
  opacity: 0;
  transform: translateY(4px) scale(0.99);
}

@media (max-width: 640px) {
  .popconfirm-layer {
    background: rgb(8 14 20 / 42%);
    pointer-events: auto;
  }

  .popconfirm-panel.is-mobile-sheet {
    inset: auto 12px max(12px, env(safe-area-inset-bottom, 0px));
    width: auto;
    max-height: min(70vh, 420px);
    overflow-y: auto;
    padding: 12px 18px max(18px, env(safe-area-inset-bottom, 0px));
    border-radius: 12px;
    box-shadow: 0 18px 50px rgb(0 0 0 / 24%);
    transition: transform 0.16s ease;
  }

  .popconfirm-panel.is-mobile-sheet.is-dragging {
    transition: none;
  }

  .popconfirm-handle {
    display: block;
    width: 36px;
    height: 4px;
    margin: 0 auto 14px;
    border-radius: 2px;
    background: var(--border-strong, #aeb6be);
    cursor: grab;
    touch-action: none;
  }

  .popconfirm-panel.is-mobile-sheet .popconfirm-actions button {
    min-height: 48px;
    flex: 1;
  }

  .popconfirm-enter-from .popconfirm-panel,
  .popconfirm-leave-to .popconfirm-panel {
    transform: translateY(16px);
  }
}
</style>
