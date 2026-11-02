<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { confirmationRequest, resolveConfirmation } from "../composables/confirmationDialog";
import { t } from "../i18n";

const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);
const isMobile = ref(window.matchMedia("(max-width: 640px)").matches);
const dragOffset = ref(0);
const isDragging = ref(false);
const remainingSeconds = ref(0);
const confirmDisabled = computed(() => remainingSeconds.value > 0);
let previousFocus: HTMLElement | null = null;
let previousOverflow = "";
let restorePreviousFocus = true;
let dragStartY: number | null = null;
let confirmationTimer: number | null = null;
let confirmationDeadline = 0;

function clearConfirmationTimer() {
  if (confirmationTimer !== null) {
    window.clearInterval(confirmationTimer);
    confirmationTimer = null;
  }
}

function updateViewport() {
  const wasMobile = isMobile.value;
  isMobile.value = window.matchMedia("(max-width: 640px)").matches;
  if (confirmationRequest.value && wasMobile !== isMobile.value) {
    document.body.style.overflow = isMobile.value ? "hidden" : previousOverflow;
  }
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
  if (shouldDismiss) {
    restorePreviousFocus = false;
    close(false);
  }
}

watch(confirmationRequest, async (request) => {
  if (request) {
    clearConfirmationTimer();
    confirmationDeadline = Date.now() + Math.max(0, request.confirmDelayMs ?? 0);
    remainingSeconds.value = Math.ceil(Math.max(0, request.confirmDelayMs ?? 0) / 1000);
    if (remainingSeconds.value > 0) {
      confirmationTimer = window.setInterval(() => {
        remainingSeconds.value = Math.ceil(Math.max(0, confirmationDeadline - Date.now()) / 1000);
        if (remainingSeconds.value === 0) clearConfirmationTimer();
      }, 100);
    }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", updateViewport);
    await nextTick();
    cancelButton.value?.focus();
  } else {
    clearConfirmationTimer();
    remainingSeconds.value = 0;
    document.body.style.overflow = previousOverflow;
    window.removeEventListener("resize", updateViewport);
    dragOffset.value = 0;
    isDragging.value = false;
    await nextTick();
    if (restorePreviousFocus) previousFocus?.focus();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    previousFocus = null;
    restorePreviousFocus = true;
  }
});

function close(confirmed: boolean, event?: MouseEvent) {
  if (confirmed && confirmDisabled.value) return;
  dragOffset.value = 0;
  isDragging.value = false;
  clearConfirmationTimer();
  if (event && "pointerType" in event && event.pointerType === "touch") {
    restorePreviousFocus = false;
  }
  resolveConfirmation(confirmed);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close(false);
  } else if (event.key === "Tab") {
    if (confirmDisabled.value) {
      event.preventDefault();
      cancelButton.value?.focus();
      return;
    }
    const first = cancelButton.value;
    const last = confirmButton.value;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

onBeforeUnmount(() => {
  clearConfirmationTimer();
  document.body.style.overflow = previousOverflow;
  window.removeEventListener("resize", updateViewport);
});
</script>

<template>
  <Transition name="confirm-dialog">
    <div
      v-if="confirmationRequest"
      class="confirm-backdrop"
      @keydown="onKeydown"
    >
      <section
        class="confirm-panel"
        :class="{ 'is-mobile-sheet': isMobile, 'is-dragging': isDragging }"
        :style="isMobile && dragOffset ? { transform: `translateY(${dragOffset}px)` } : {}"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabindex="-1"
      >
        <span
          v-if="isMobile"
          class="confirm-handle"
          aria-hidden="true"
          @pointerdown="startSheetDrag"
          @pointermove="moveSheetDrag"
          @pointerup="endSheetDrag"
          @pointercancel="endSheetDrag"
        ></span>
        <span class="confirm-indicator" :class="`confirm-${confirmationRequest.kind}`" aria-hidden="true">
          {{ confirmationRequest.kind === "warning" ? "!" : "i" }}
        </span>
        <div class="confirm-copy">
          <h2 id="confirm-dialog-title">{{ confirmationRequest.title }}</h2>
          <p id="confirm-dialog-message">{{ confirmationRequest.message }}</p>
        </div>
        <div class="confirm-actions">
          <button ref="cancelButton" class="confirm-cancel" type="button" @click="close(false, $event)">
            {{ confirmationRequest.cancelLabel ?? t("取消", "Cancel") }}
          </button>
          <button ref="confirmButton" class="confirm-accept" :class="{ 'is-danger': confirmationRequest.kind === 'warning' }" type="button" :disabled="confirmDisabled" @click="close(true, $event)">
            {{ confirmationRequest.okLabel ?? t("确定", "Confirm") }}
            <span v-if="confirmDisabled" aria-live="off">（{{ t(`${remainingSeconds} 秒`, `${remainingSeconds}s`) }}）</span>
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(8 14 20 / 58%);
  backdrop-filter: blur(2px);
}

.confirm-panel {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 6px 14px;
  width: min(440px, 100%);
  padding: 24px;
  border: 1px solid var(--border, #d2d8de);
  border-radius: 5px;
  background: var(--surface, #fff);
  color: var(--text, #25282b);
  box-shadow: 0 24px 72px rgb(0 0 0 / 28%);
}

.confirm-indicator {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent-tint, #e7f2fb);
  color: var(--accent, #2379b8);
  font-size: 1.3em;
  font-weight: 700;
}

.confirm-warning {
  background: rgb(200 72 64 / 12%);
  color: #c84840;
}

.confirm-copy h2 {
  margin: 0;
  font-size: 1.15em;
}

.confirm-copy p {
  margin: 8px 0 0;
  color: var(--muted, #68727b);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.confirm-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.confirm-actions button {
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 4px;
  background: var(--surface, #fff);
  color: var(--text, #25282b);
  font: inherit;
  cursor: pointer;
}

.confirm-actions button:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 2px;
}

.confirm-actions .confirm-accept {
  border-color: var(--accent, #4aa8f4);
  background: var(--accent, #4aa8f4);
  color: #fff;
}

.confirm-actions .confirm-accept.is-danger {
  border-color: #c84840;
  background: #c84840;
}

.confirm-actions .confirm-accept:disabled {
  border-color: var(--border-strong, #aeb6be);
  background: var(--surface-alt, #f5f7f9);
  color: var(--muted, #68727b);
  cursor: not-allowed;
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 0.16s ease;
}

.confirm-dialog-enter-active .confirm-panel,
.confirm-dialog-leave-active .confirm-panel {
  transition: transform 0.16s ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-from .confirm-panel,
.confirm-dialog-leave-to .confirm-panel {
  transform: translateY(8px) scale(0.98);
}

@media (max-width: 640px) {
  .confirm-backdrop {
    place-items: end center;
    padding: 0;
    background: rgb(8 14 20 / 42%);
    backdrop-filter: none;
  }

  .confirm-panel.is-mobile-sheet {
    width: calc(100vw - 24px);
    max-height: min(84vh, 620px);
    overflow-y: auto;
    margin: 0 12px max(12px, env(safe-area-inset-bottom, 0px));
    padding: 12px 18px max(18px, env(safe-area-inset-bottom, 0px));
    border-radius: 12px;
    box-shadow: 0 18px 50px rgb(0 0 0 / 24%);
    transition: transform 0.16s ease;
  }

  .confirm-panel.is-mobile-sheet.is-dragging {
    transition: none;
  }

  .confirm-handle {
    grid-column: 1 / -1;
    display: block;
    width: 36px;
    height: 4px;
    justify-self: center;
    margin: 0 auto 4px;
    border-radius: 2px;
    background: var(--border-strong, #aeb6be);
    cursor: grab;
    touch-action: none;
  }

  .confirm-actions button {
    min-height: 48px;
    flex: 1;
  }

  .confirm-dialog-enter-from .confirm-panel,
  .confirm-dialog-leave-to .confirm-panel {
    transform: translateY(16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-dialog-enter-active,
  .confirm-dialog-leave-active,
  .confirm-dialog-enter-active .confirm-panel,
  .confirm-dialog-leave-active .confirm-panel {
    transition-duration: 0.01ms;
  }
}
</style>
