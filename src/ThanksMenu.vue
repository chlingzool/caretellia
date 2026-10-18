<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { t } from "./i18n";

const emit = defineEmits<{
  (event: "close"): void;
}>();

const closeButton = ref<HTMLButtonElement | null>(null);
const dialog = ref<HTMLElement | null>(null);

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close");
    return;
  }
  if (event.key !== "Tab" || !dialog.value) return;

  const focusable = dialog.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  const first = focusable.item(0);
  const last = focusable.item(focusable.length - 1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  closeButton.value?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="thanks-backdrop" @click.self="emit('close')">
    <section
      ref="dialog"
      class="thanks-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thanks-title"
      aria-describedby="thanks-intro"
    >
      <header class="thanks-header">
        <div>
          <p class="thanks-eyebrow">{{ t("致谢与声明", "Acknowledgements") }}</p>
          <h2 id="thanks-title">{{ t("感谢开源社区与每一份协助", "Thanks to the open-source community and everyone who helped") }}</h2>
          <p id="thanks-intro">{{ t("项目中使用的开源框架与项目，以及作者信息。", "Open-source projects used by Caretellia and information about its author.") }}</p>
        </div>
        <button ref="closeButton" class="thanks-close" type="button" :aria-label="t('关闭感谢菜单', 'Close acknowledgements')" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div class="thanks-content">
        <section class="thanks-section author-section" aria-labelledby="author-heading">
          <h3 id="author-heading">{{ t("作者", "Author") }}</h3>
          <p class="author-name">chlingzool</p>
          <div class="author-links">
            <a href="https://gravatar.com/chlingzool" target="_blank" rel="noreferrer">Gravatar <span aria-hidden="true">↗</span></a>
            <a href="https://afdian.com/a/chlingzool" target="_blank" rel="noreferrer">{{ t("爱发电", "Afdian") }} <span aria-hidden="true">↗</span></a>
            <a href="mailto:chlingzool@outlook.com">chlingzool@outlook.com</a>
          </div>
        </section>

        <section class="thanks-section" aria-labelledby="opensource-heading">
          <h3 id="opensource-heading">{{ t("框架与开源项目", "Frameworks & open-source projects") }}</h3>
          <ul class="credits-list">
            <li>
              <a href="https://vuejs.org/" target="_blank" rel="noreferrer">Vue</a>
              <a class="license-link" href="https://opensource.org/license/mit" target="_blank" rel="noreferrer">{{ t("许可证", "License") }}</a>
            </li>
            <li>
              <a href="https://tauri.app/" target="_blank" rel="noreferrer">Tauri</a>
              <span class="license-links">
                <a class="license-link" href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">Apache-2.0</a>
                <a class="license-link" href="https://opensource.org/license/mit" target="_blank" rel="noreferrer">MIT</a>
              </span>
            </li>
            <li>
              <a href="https://vite.dev/" target="_blank" rel="noreferrer">Vite</a>
              <a class="license-link" href="https://opensource.org/license/mit" target="_blank" rel="noreferrer">{{ t("许可证", "License") }}</a>
            </li>
          </ul>
        </section>

        <section class="thanks-section project-section" aria-labelledby="project-heading">
          <h3 id="project-heading">{{ t("项目版本", "Project version") }}</h3>
          <a class="repository-link" href="https://github.com/chlingzool/caretellia" target="_blank" rel="noreferrer">{{ t("Caretellia GitHub 仓库", "Caretellia GitHub repository") }} <span aria-hidden="true">↗</span></a>
          <span class="version-badge">v1</span>
        </section>

        <section class="thanks-section special-thanks" aria-labelledby="special-heading">
          <h3 id="special-heading">{{ t("特别感谢", "Special thanks") }}</h3>
          <p>{{ t("在", "Before") }} <a href="https://github.com/chlingzool/caretellia/commit/4a7a2f8796c6f306ddaa1289828882cb48b4c1e1">Commit 4a7a2f8</a> {{ t("之前, 项目大部分代码交由", "most of all project code was written by") }} <a href="https://github.com/features/copilot" target="_blank" rel="noreferrer">GitHub Copilot</a> {{ t("负责(已进行人工审核)，感谢 GitHub 让我这种穷学生也吃上好的了。", "(and manually reviewed). Thanks to GitHub for giving a broke student like me access to the good stuff.") }}</p>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.thanks-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(17 24 32 / 48%);
  backdrop-filter: blur(3px);
}

.thanks-dialog {
  display: flex;
  flex-direction: column;
  width: min(720px, 100%);
  max-height: min(84vh, 820px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 72px rgb(0 0 0 / 28%);
}

.thanks-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 28px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-alt);
}

.thanks-eyebrow {
  margin: 0 0 6px;
  color: #a94f55;
  font-size: 0.8em;
  font-weight: 650;
  letter-spacing: 0.08em;
}

.thanks-header h2 {
  margin: 0;
  font-size: 1.5em;
  font-weight: 650;
}

.thanks-header p:last-child {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.55;
}

.thanks-close {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.thanks-close:hover {
  border-color: #a94f55;
  color: #a94f55;
}

.thanks-close:focus-visible,
.author-links a:focus-visible,
.credits-list a:focus-visible,
.repository-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.thanks-close svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.thanks-content {
  overflow: auto;
  padding: 8px 28px 24px;
}

.thanks-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}

.thanks-section:last-child {
  border-bottom: 0;
}

.thanks-section h3 {
  margin: 0 0 10px;
  font-size: 1em;
  font-weight: 650;
}

.thanks-section p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.author-name {
  margin-bottom: 9px !important;
  color: var(--text) !important;
  font-size: 1.15em;
  font-weight: 650;
}

.author-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}

.author-links a {
  color: var(--accent);
  text-decoration: none;
}

.author-links a:hover {
  text-decoration: underline;
}

.credits-list a {
  color: var(--accent);
  text-decoration: none;
}

.credits-list a:hover {
  text-decoration: underline;
}

.credits-list {
  display: flex;
  flex-direction: column;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.credits-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.credits-list li > a:first-child {
  display: flex;
  font-weight: 600;
}

.license-links {
  display: flex;
  gap: 12px;
}

.license-link {
  font-size: 0.86em;
}

.project-section {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 14px;
}

.project-section h3 {
  flex: 0 0 100%;
}

.repository-link {
  color: var(--accent);
  text-decoration: none;
}

.repository-link:hover {
  text-decoration: underline;
}

.version-badge {
  padding: 3px 9px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface-alt);
  color: var(--text);
  font-size: 0.78em;
  font-weight: 650;
  line-height: 1.4;
}

.special-thanks {
  padding-bottom: 4px;
}

@media (max-width: 560px) {
  .thanks-backdrop {
    align-items: end;
    padding: 0;
  }

  .thanks-dialog {
    width: 100%;
    max-height: 90vh;
    border-radius: 8px 8px 0 0;
  }

  .thanks-header {
    padding: 20px 18px 16px;
  }

  .thanks-content {
    padding: 4px 18px 20px;
  }

}
</style>
