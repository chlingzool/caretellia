<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

export interface AppSelectOption {
  label: string;
  value: string;
}

const props = defineProps<{
  modelValue: string;
  options: AppSelectOption[];
  ariaLabel?: string;
  ariaLabelledby?: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "change", value: string): void;
}>();

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const isOpen = ref(false);
const activeIndex = ref(0);
const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue));
const optionButtons = () => root.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [];

function focusOption(index: number) {
  optionButtons()[index]?.focus();
}

function openMenu(index = props.options.findIndex((option) => option.value === props.modelValue), focus = true) {
  if (!props.options.length) return;
  activeIndex.value = (index + props.options.length) % props.options.length;
  isOpen.value = true;
  if (focus) void nextTick(() => focusOption(activeIndex.value));
}

function closeMenu(restoreFocus = true) {
  isOpen.value = false;
  if (restoreFocus) void nextTick(() => trigger.value?.focus());
}

function isTouchClick(event: MouseEvent) {
  return "pointerType" in event && event.pointerType === "touch";
}

function onTriggerClick(event: MouseEvent) {
  if (isOpen.value) closeMenu(!isTouchClick(event));
  else openMenu(undefined, !isTouchClick(event));
}

function selectOption(option: AppSelectOption, event: MouseEvent) {
  emit("update:modelValue", option.value);
  emit("change", option.value);
  closeMenu(!isTouchClick(event));
}

function moveActive(delta: number) {
  activeIndex.value = (activeIndex.value + delta + props.options.length) % props.options.length;
  void nextTick(() => focusOption(activeIndex.value));
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const selected = props.options.findIndex((option) => option.value === props.modelValue);
    const baseIndex = selected < 0 ? (direction > 0 ? -1 : 0) : selected;
    openMenu(baseIndex + direction);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openMenu();
  }
}

function onOptionKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    activeIndex.value = event.key === "Home" ? 0 : props.options.length - 1;
    void nextTick(() => focusOption(activeIndex.value));
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
  } else if (event.key === "Tab") {
    window.setTimeout(() => closeMenu(false), 0);
  }
}

function onOutsidePointerDown(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) closeMenu(false);
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) closeMenu();
}

onMounted(() => {
  document.addEventListener("pointerdown", onOutsidePointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onOutsidePointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <div ref="root" class="app-select">
    <button
      ref="trigger"
      class="app-select-trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
      :aria-expanded="isOpen"
      @click="onTriggerClick"
      @keydown="onTriggerKeydown"
    >
      <span>{{ selectedOption?.label ?? modelValue }}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg>
    </button>
    <Transition name="app-select-list">
      <div v-if="isOpen" class="app-select-options" role="listbox">
        <button
          v-for="(option, index) in options"
          :key="option.value"
          class="app-select-option"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          :tabindex="activeIndex === index ? 0 : -1"
          @click="selectOption(option, $event)"
          @keydown="onOptionKeydown"
        >{{ option.label }}</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  display: inline-block;
  min-width: 0;
  color: var(--text, #25282b);
  font: inherit;
}

.app-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 7px 10px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 3px;
  background: var(--surface, #fff);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.app-select-trigger:hover,
.app-select-trigger[aria-expanded="true"] {
  border-color: var(--accent, #4aa8f4);
}

.app-select-trigger:focus-visible,
.app-select-option:focus-visible {
  outline: 2px solid var(--accent, #4aa8f4);
  outline-offset: 1px;
}

.app-select-trigger svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.app-select-options {
  position: absolute;
  inset: calc(100% + 4px) 0 auto;
  z-index: 60;
  display: grid;
  max-height: min(280px, 50vh);
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--border-strong, #aeb6be);
  border-radius: 3px;
  background: var(--surface, #fff);
  box-shadow: 0 10px 24px rgb(0 0 0 / 20%);
}

.app-select-list-enter-active,
.app-select-list-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
  transform-origin: top center;
}

.app-select-list-enter-from,
.app-select-list-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

.app-select-option {
  min-height: 40px;
  padding: 8px 10px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.app-select-option:hover,
.app-select-option[aria-selected="true"] {
  background: var(--accent-tint, #e7f2fb);
  color: var(--accent, #2379b8);
}

@media (hover: none) and (pointer: coarse) {
  .app-select-trigger,
  .app-select-option {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
