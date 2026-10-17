<script setup lang="ts">
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
    <option value="system-ui">系统默认</option>
    <option v-for="font in fonts" :key="font" :value="font">{{ font }}</option>
  </select>
</template>
