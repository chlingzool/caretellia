<script setup lang="ts">
import { currentToast, dismissToast, pauseToast, resumeToast, toastProgress } from "../composables/toast";
import { t } from "../i18n";

const pauseSources = new Set<string>();

function setPauseSource(source: string, shouldPause: boolean) {
  if (shouldPause) pauseSources.add(source);
  else pauseSources.delete(source);
  if (pauseSources.size > 0) pauseToast();
  else resumeToast();
}
</script>

<template>
  <Transition name="toast">
    <div
      v-if="currentToast"
      :key="currentToast.id"
      class="toast-message toast-success"
      role="status"
      aria-live="polite"
      @mouseenter="setPauseSource('hover', true)"
      @mouseleave="setPauseSource('hover', false)"
      @focusin="setPauseSource('focus', true)"
      @focusout="setPauseSource('focus', false)"
    >
      <span class="toast-mark" aria-hidden="true">✓</span>
      <p>{{ currentToast.message }}</p>
      <button type="button" :aria-label="t('关闭提示', 'Dismiss message')" @click="dismissToast">×</button>
      <span class="toast-progress-track" aria-hidden="true">
        <span class="toast-progress-bar" :style="{ transform: `scaleX(${toastProgress / 100})` }"></span>
      </span>
    </div>
  </Transition>
</template>

<style>
.toast-message {
  position: fixed;
  z-index: 150;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: min(520px, calc(100vw - 32px));
  min-height: 56px;
  padding: 8px 10px 8px 14px;
  border: 1px solid var(--border, #d2d8de);
  border-radius: 5px;
  background: var(--surface, #fff);
  color: var(--text, #25282b);
  box-shadow: 0 8px 26px rgb(0 0 0 / 16%);
  transform: translateX(-50%);
}

.toast-progress-track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  overflow: hidden;
  border-radius: 0 0 4px 4px;
  background: var(--surface-alt, #f1f3f5);
}

.toast-progress-bar {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--accent, #2379b8);
  transform-origin: left center;
  transition: transform 30ms linear;
}

.toast-mark {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-tint, #e7f2fb);
  color: var(--accent, #2379b8);
  font-weight: 700;
}

.toast-success .toast-mark {
  background: rgb(65 128 91 / 14%);
  color: var(--success, #347a50);
}

.toast-message p {
  margin: 0;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.toast-message button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--muted, #68727b);
  font: inherit;
  font-size: 1.25em;
  cursor: pointer;
}

.toast-message button:hover {
  background: var(--surface-hover, #f1f3f5);
  color: var(--text, #25282b);
}

.toast-message button:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 1px;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 520px) {
  .toast-message {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
    max-width: calc(100vw - 24px);
    min-height: 60px;
    padding-left: 12px;
  }
}
</style>
