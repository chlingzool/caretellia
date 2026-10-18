<script setup lang="ts">
import { computed, ref } from "vue";
import { letterTemplates, localizeTemplate } from "./templates";
import { locale, t } from "./i18n";
import type { LetterTemplate } from "./types/postcard";

const emit = defineEmits<{
  (event: "select", template: LetterTemplate): void;
}>();

const categories = ["all", "明信片", "信封", "信纸", "文案风格"] as const;
const activeCategory = ref<(typeof categories)[number]>("all");
const localizedTemplates = computed(() =>
  letterTemplates.map((template) => localizeTemplate(template, locale.value)),
);
const visibleTemplates = computed(() => activeCategory.value === "all"
  ? localizedTemplates.value
  : localizedTemplates.value.filter((template) => template.category === activeCategory.value));

function categoryLabel(category: (typeof categories)[number]) {
  if (category === "all") return t("全部", "All");
  if (category === "明信片") return t("明信片", "Postcard");
  if (category === "信封") return t("信封", "Envelope");
  if (category === "信纸") return t("信纸", "Letter sheet");
  return t("文案风格", "Writing styles");
}
</script>

<template>
  <section class="template-gallery">
    <header class="gallery-heading">
      <div>
        <p class="eyebrow">{{ t("灵感与版式", "Inspiration & layouts") }}</p>
        <h1>{{ t("从模板开始", "Browse templates") }}</h1>
        <p class="description">{{ t("先选一份接近心意的初稿，再写成只属于你们的故事。称呼、正文和样式都可以继续修改。", "Start with a draft that feels close, then make it your own. You can edit every line, name, and design detail.") }}</p>
      </div>
      <span class="template-count">{{ t(`${visibleTemplates.length} 份灵感`, `${visibleTemplates.length} ideas`) }}</span>
    </header>

    <nav class="category-filter" :aria-label="t('模板分类', 'Template categories')">
      <button
        v-for="category in categories"
        :key="category"
        type="button"
        :class="{ active: activeCategory === category }"
        @click="activeCategory = category"
      >{{ categoryLabel(category) }}</button>
    </nav>

    <div class="template-grid">
      <button
        v-for="template in visibleTemplates"
        :key="template.id"
        class="template-card"
        type="button"
        @click="emit('select', template)"
      >
        <span class="template-art" :class="{ envelope: template.category === '信封', letter: template.category === '信纸' }" :style="{ '--paper': template.data.bgColor || '#f5eee2', '--ink': template.data.textColor || '#43392f', '--trim': template.data.borderColor || '#c6aa88' }">
          <span class="art-corner">CARE · {{ template.category === '信封' ? 'POST' : template.category === '信纸' ? 'LETTER' : '02' }}</span>
          <span class="art-stamp">{{ template.data.stampText || '✦' }}</span>
          <span class="art-title">{{ template.data.title || template.label }}</span>
          <span class="art-caption">{{ template.data.caption || template.description }}</span>
          <span class="art-lines" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="art-flap" aria-hidden="true"></span>
        </span>
        <span class="template-meta">
          <span class="template-title">{{ template.label }}</span>
          <span class="template-category">{{ categoryLabel(template.category) }}</span>
          <span class="template-description">{{ template.description }}</span>
        </span>
        <span class="template-use">{{ t("用这份初稿", "Start with this draft") }} <span aria-hidden="true">→</span></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.template-gallery {
  color: var(--text);
}

.gallery-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 0 0 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 0.8571em;
  font-weight: 650;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0;
  font-size: 2.1429em;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.description {
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 0.9286em;
}

.template-count {
  color: var(--muted);
  font-size: 0.8571em;
}

.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 18px;
}

.category-filter button {
  min-height: 40px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 0.8571em;
  cursor: pointer;
}

.category-filter button:hover,
.category-filter button.active {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(245px, 1fr));
  gap: 18px;
}

.template-card {
  display: flex;
  flex-direction: column;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface);
  color: var(--text);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.template-card:hover,
.template-card:focus-visible {
  border-color: var(--accent);
  background: var(--surface-hover);
  outline: none;
}

.template-art {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 7px;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 9px solid #fbfaf7;
  background:
    radial-gradient(ellipse at 16% 25%, color-mix(in srgb, var(--trim), transparent 78%), transparent 42%),
    linear-gradient(145deg, color-mix(in srgb, var(--paper), white 18%), var(--paper));
  color: var(--ink);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--trim), transparent 50%);
}

.template-art.envelope {
  border-width: 0;
  background:
    linear-gradient(32deg, transparent 49.7%, rgba(79, 49, 27, 0.28) 49.9%, rgba(255,255,255,.42) 50.1%, transparent 50.3%),
    linear-gradient(-32deg, transparent 49.7%, rgba(79, 49, 27, 0.24) 49.9%, rgba(255,255,255,.36) 50.1%, transparent 50.3%),
    linear-gradient(145deg, color-mix(in srgb, var(--paper), white 13%), color-mix(in srgb, var(--paper), #805832 12%));
}

.template-art.letter {
  justify-content: flex-start;
  padding: 42px 24px 20px;
  border-width: 0 0 0 5px;
  border-color: color-mix(in srgb, var(--trim), transparent 24%);
  background-color: var(--paper);
  background-image:
    radial-gradient(ellipse at 12% 16%, rgba(151, 113, 66, 0.12), transparent 42%),
    repeating-linear-gradient(0deg, transparent 0, transparent 27px, color-mix(in srgb, var(--trim), transparent 74%) 28px, transparent 29px),
    repeating-linear-gradient(90deg, rgba(125, 97, 57, 0.018) 0, rgba(125, 97, 57, 0.018) 1px, transparent 1px, transparent 5px);
}

.art-corner {
  position: absolute;
  top: 10px;
  left: 12px;
  color: color-mix(in srgb, var(--ink), transparent 36%);
  font-size: 0.5714em;
  letter-spacing: 0.12em;
}

.art-stamp {
  position: absolute;
  top: 14px;
  right: 15px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 34px;
  border: 1px dashed var(--trim);
  background: color-mix(in srgb, var(--paper), white 48%);
  color: var(--ink);
  font-size: 1.0714em;
}

.envelope .art-stamp {
  top: 18px;
  right: 22px;
}

.art-title {
  max-width: 76%;
  overflow: hidden;
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: clamp(1em, calc(var(--ui-font-size) * 1.4), 1.5em);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.art-caption {
  max-width: 76%;
  display: -webkit-box;
  overflow: hidden;
  color: color-mix(in srgb, var(--ink), transparent 24%);
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: 0.7143em;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.art-lines {
  position: absolute;
  right: 15%;
  bottom: 13%;
  left: 15%;
  display: grid;
  gap: 6px;
}

.art-lines i {
  height: 1px;
  background: color-mix(in srgb, var(--trim), transparent 48%);
}

.art-lines i:nth-child(2) {
  width: 83%;
}

.art-lines i:nth-child(3) {
  width: 64%;
}

.art-flap {
  display: none;
}

.envelope .art-flap {
  position: absolute;
  inset: 0;
  display: block;
  clip-path: polygon(0 0, 100% 0, 50% 54%);
  background: linear-gradient(160deg, color-mix(in srgb, var(--paper), white 15%), color-mix(in srgb, var(--paper), #704a2c 14%));
  filter: drop-shadow(0 2px 2px rgba(40, 26, 15, 0.3));
  opacity: 0.86;
}

.envelope .art-stamp,
.letter .art-stamp,
.envelope .art-title,
.letter .art-title,
.envelope .art-caption,
.letter .art-caption,
.envelope .art-corner,
.letter .art-corner {
  z-index: 1;
}

.template-meta {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 8px;
  padding: 12px 3px 9px;
}

.template-title {
  font-size: 1em;
  font-weight: 600;
}

.template-category {
  color: var(--accent);
  font-size: 0.7143em;
}

.template-description {
  grid-column: 1 / -1;
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7857em;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.template-use {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 9px 3px 2px;
  border-top: 1px solid var(--border);
  color: var(--accent);
  font-size: 0.8571em;
  font-weight: 600;
}

@media (max-width: 600px) {
  .gallery-heading {
    align-items: flex-start;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }
}

@media (hover: none) and (pointer: coarse) {
  .category-filter button {
    min-height: 44px;
    padding-right: 14px;
    padding-left: 14px;
  }

  .template-card {
    padding: 12px;
  }

  .template-use {
    min-height: 44px;
  }
}
</style>
