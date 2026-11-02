<script setup lang="ts">
import { computed } from "vue";
import AppSelect from "./AppSelect.vue";
import { t } from "../i18n";

const props = defineProps<{
  modelValue: string;
  fonts: string[];
}>();

const emit = defineEmits<{
  (event: "update:modelValue", font: string): void;
}>();

const options = computed(() => [
  { value: "system-ui", label: t("系统默认", "System default") },
  ...props.fonts.map((font) => ({ value: font, label: font })),
]);
</script>

<template>
  <AppSelect
    :model-value="modelValue"
    :options="options"
    :aria-label="t('字体', 'Font')"
    @change="emit('update:modelValue', $event)"
  />
</template>
