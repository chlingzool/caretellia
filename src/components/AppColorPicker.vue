<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { t } from "../i18n";

const props = defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ (event: "update:modelValue", value: string): void }>();
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const colorPad = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const draft = ref(props.modelValue);
const hsv = ref(hexToHsv(props.modelValue));
const isValid = computed(() => /^#[\da-f]{6}$/i.test(draft.value));
const hueColor = computed(() => `hsl(${hsv.value.h} 100% 50%)`);
const padLabel = computed(() =>
  t(`颜色选择，色相 ${Math.round(hsv.value.h)} 度，饱和度 ${Math.round(hsv.value.s)}%，亮度 ${Math.round(hsv.value.v)}%`,
    `Color picker, hue ${Math.round(hsv.value.h)} degrees, saturation ${Math.round(hsv.value.s)}%, brightness ${Math.round(hsv.value.v)}%`),
);
let isDragging = false;

function hexToHsv(hex: string) {
  const normalized = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : "4aa8f4";
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: (hue + 360) % 360,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const chroma = (value / 100) * (saturation / 100);
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const offset = value / 100 - chroma;
  const [red, green, blue] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function updateColor() {
  const color = hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v);
  draft.value = color;
  emit("update:modelValue", color);
}

watch(() => props.modelValue, (value) => {
  draft.value = value;
  if (/^#[\da-f]{6}$/i.test(value)) hsv.value = hexToHsv(value);
});

function updateFromPoint(clientX: number, clientY: number) {
  const bounds = colorPad.value?.getBoundingClientRect();
  if (!bounds) return;
  hsv.value.s = Math.min(100, Math.max(0, ((clientX - bounds.left) / bounds.width) * 100));
  hsv.value.v = Math.min(100, Math.max(0, (1 - (clientY - bounds.top) / bounds.height) * 100));
  updateColor();
}

function startColorDrag(event: PointerEvent) {
  isDragging = true;
  colorPad.value?.setPointerCapture(event.pointerId);
  updateFromPoint(event.clientX, event.clientY);
}

function moveColorDrag(event: PointerEvent) {
  if (isDragging) updateFromPoint(event.clientX, event.clientY);
}

function endColorDrag() {
  isDragging = false;
}

function onColorPadKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 5 : 1;
  if (event.key === "ArrowLeft") hsv.value.s = Math.max(0, hsv.value.s - step);
  else if (event.key === "ArrowRight") hsv.value.s = Math.min(100, hsv.value.s + step);
  else if (event.key === "ArrowUp") hsv.value.v = Math.min(100, hsv.value.v + step);
  else if (event.key === "ArrowDown") hsv.value.v = Math.max(0, hsv.value.v - step);
  else return;
  event.preventDefault();
  updateColor();
}

function updateHue(event: Event) {
  hsv.value.h = Number((event.target as HTMLInputElement).value);
  updateColor();
}

function applyDraft() {
  if (isValid.value) {
    hsv.value = hexToHsv(draft.value);
    emit("update:modelValue", draft.value.toUpperCase());
  }
}

function closeOnOutsidePointer(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) isOpen.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) {
    isOpen.value = false;
    trigger.value?.focus();
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", closeOnOutsidePointer);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeOnOutsidePointer);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="root" class="color-picker">
    <button
      ref="trigger"
      class="color-trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-label="t(`选择${label}`, `Choose ${label}`)"
      @click="isOpen = !isOpen"
    >
      <span class="color-swatch" :style="{ backgroundColor: modelValue }"></span>
      <span>{{ modelValue.toUpperCase() }}</span>
      <span class="color-chevron" aria-hidden="true">▾</span>
    </button>
    <Transition name="color-popover">
      <div v-if="isOpen" class="color-popover" role="dialog" :aria-label="t(`选择${label}`, `Choose ${label}`)">
      <div
        ref="colorPad"
        class="color-pad"
        role="slider"
        tabindex="0"
        :aria-label="t('饱和度和亮度', 'Saturation and brightness')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(hsv.v)"
        :aria-valuetext="padLabel"
        :style="{ '--picker-hue': hueColor, '--picker-x': `${hsv.s}%`, '--picker-y': `${100 - hsv.v}%` }"
        @pointerdown="startColorDrag"
        @pointermove="moveColorDrag"
        @pointerup="endColorDrag"
        @pointercancel="endColorDrag"
        @keydown="onColorPadKeydown"
      >
        <span class="color-pad-marker" aria-hidden="true"></span>
      </div>
      <label class="hue-control">
        <span>{{ t("色相", "Hue") }}</span>
        <input type="range" min="0" max="359" step="1" :value="Math.round(hsv.h)" :aria-label="t('色相', 'Hue')" @input="updateHue" />
      </label>
      <label class="hex-input">
        <span>{{ t("颜色代码", "Color code") }}</span>
        <input v-model="draft" type="text" inputmode="text" maxlength="7" spellcheck="false" aria-label="HEX" @input="applyDraft" />
      </label>
      <p v-if="!isValid" class="color-error" role="alert">{{ t("请输入 #RRGGBB 格式的颜色代码。", "Enter a color code in #RRGGBB format.") }}</p>
        <button class="color-done" type="button" @click="isOpen = false">{{ t("完成", "Done") }}</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.color-picker {
  position: relative;
  display: inline-block;
  max-width: 100%;
  color: var(--text, #25282b);
  font: inherit;
}

.color-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 132px;
  min-height: 40px;
  padding: 6px 10px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 3px;
  background: var(--surface, #fff);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.color-trigger:hover,
.color-trigger[aria-expanded="true"] {
  border-color: var(--accent, #4aa8f4);
}

.color-swatch {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 3px;
}

.color-chevron {
  margin-left: auto;
  color: var(--muted, #68727b);
}

.color-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 70;
  width: min(240px, calc(100vw - 40px));
  padding: 12px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 4px;
  background: var(--surface, #fff);
  box-shadow: 0 12px 28px rgb(0 0 0 / 20%);
}

.color-popover-enter-active,
.color-popover-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
  transform-origin: top left;
}

.color-popover-enter-from,
.color-popover-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

.color-pad {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 3px;
  background-color: var(--picker-hue);
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);
  cursor: crosshair;
  touch-action: none;
}

.color-pad:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 2px;
}

.color-pad-marker {
  position: absolute;
  top: var(--picker-y);
  left: var(--picker-x);
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 75%);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hue-control {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--muted, #68727b);
  font-size: 0.86em;
}

.hue-control input {
  width: 100%;
  height: 24px;
  margin: 0;
  appearance: none;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
}

.hue-control input::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  appearance: none;
  border: 2px solid #fff;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 65%);
}

.hue-control input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 65%);
}

.hex-input {
  display: grid;
  grid-template-columns: 1fr 82px;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  color: var(--muted, #68727b);
  font-size: 0.86em;
}

.hex-input input {
  width: 100%;
  min-height: 36px;
  padding: 5px 7px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 3px;
  background: var(--surface, #fff);
  color: var(--text, #25282b);
  font: inherit;
}

.hex-input input:focus-visible,
.color-trigger:focus-visible,
.hue-control input:focus-visible,
.color-done:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 2px;
}

.color-error {
  margin: 7px 0 0;
  color: #c84840;
  font-size: 0.8em;
}

.color-done {
  display: block;
  min-height: 36px;
  margin: 10px 0 0 auto;
  padding: 6px 12px;
  border: 0;
  border-radius: 3px;
  background: var(--accent, #4aa8f4);
  color: #fff;
  font: inherit;
  cursor: pointer;
}

@media (hover: none) and (pointer: coarse) {
  .color-trigger {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
