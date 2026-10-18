<script setup lang="ts">
import { t } from "../i18n";

defineProps<{
  modelValue: string;
  fonts: string[];
}>();

defineEmits<{
  (event: "update:modelValue", font: string): void;
}>();
</script>

<template>
  <select :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option value="system-ui">{{ t("系统默认", "System default") }}</option>
    <option v-for="font in fonts" :key="font" :value="font">{{ font }}</option>
  </select>
</template>
