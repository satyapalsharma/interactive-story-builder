<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  DEFAULT_NODE_BACKGROUND,
  MAX_COLOR_LENGTH,
  MAX_NODE_TITLE_LENGTH,
  nodeHeading,
} from '@/lib/nodeContent';
import { MAX_NODE_TEXT_LENGTH } from '@/lib/nodeGraph';
import type { StoryNode } from '@/types/story';

const props = defineProps<{
  /** The node being edited. The component works on a copy and only emits on save. */
  node: StoryNode;
}>();

const emit = defineEmits<{
  /** Persist the edited content; payload holds only validated values. */
  (e: 'save', edit: { text: string; title: string; backgroundColor: string }): void;
  /** Dismiss the editor without persisting. */
  (e: 'close'): void;
}>();

const text = ref(props.node.text);
const title = ref(typeof props.node.title === 'string' ? props.node.title : '');
const backgroundColor = ref(
  typeof props.node.backgroundColor === 'string'
    ? props.node.backgroundColor
    : DEFAULT_NODE_BACKGROUND,
);

// Keep this instance in sync when the same node object is re-assigned with
// different content (the parent also re-keys, this covers in-place updates).
watch(
  () => props.node,
  (next) => {
    text.value = next.text;
    title.value = typeof next.title === 'string' ? next.title : '';
    backgroundColor.value =
      typeof next.backgroundColor === 'string'
        ? next.backgroundColor
        : DEFAULT_NODE_BACKGROUND;
  },
);

const colorValid = computed(() => {
  const value = backgroundColor.value.trim();
  return (
    value.length > 0 &&
    value.length <= MAX_COLOR_LENGTH &&
    /^#([0-9a-f]{3,4}|[0-9a-f]{6,8})$/i.test(value)
  );
});

const textError = computed(() => {
  const trimmed = text.value.trim();
  if (trimmed.length === 0) return 'Node text cannot be empty.';
  if (trimmed.length > MAX_NODE_TEXT_LENGTH) {
    return `Node text must be at most ${MAX_NODE_TEXT_LENGTH} characters.`;
  }
  return '';
});

const previewHeading = computed(() => {
  const node: StoryNode = {
    id: props.node.id,
    text: text.value,
    choices: [],
  };
  if (title.value.trim().length > 0) node.title = title.value.trim();
  return nodeHeading(node);
});

function applyDefaultColor() {
  backgroundColor.value = DEFAULT_NODE_BACKGROUND;
}

function onSave() {
  if (textError.value.length > 0 || !colorValid.value) return;
  emit('save', {
    text: text.value.trim(),
    title: title.value.trim(),
    backgroundColor: backgroundColor.value.trim().toLowerCase(),
  });
}

function onCancel() {
  text.value = props.node.text;
  title.value =
    typeof props.node.title === 'string' ? props.node.title : '';
  backgroundColor.value =
    typeof props.node.backgroundColor === 'string'
      ? props.node.backgroundColor
      : DEFAULT_NODE_BACKGROUND;
  emit('close');
}
</script>

<template>
  <section
    class="node-editor"
    aria-label="Node content editor"
    data-testid="node-editor"
  >
    <header class="node-editor__header">
      <h3 class="node-editor__heading">
        Edit node <span class="node-editor__node-id">{{ node.id }}</span>
      </h3>
      <button
        type="button"
        class="node-editor__close"
        data-testid="node-editor-close"
        @click="onCancel"
      >
        Close
      </button>
    </header>

    <form class="node-editor__form" novalidate @submit.prevent="onSave">
      <div class="node-editor__field">
        <label class="node-editor__label" for="node-text">
          Scene text <span class="node-editor__required" aria-hidden="true">*</span>
        </label>
        <textarea
          id="node-text"
          v-model="text"
          class="node-editor__textarea"
          :class="{ 'node-editor__invalid': textError !== '' }"
          rows="5"
          data-testid="node-editor-text"
          :aria-invalid="textError !== ''"
          :aria-describedby="textError !== '' ? 'node-text-error' : undefined"
        ></textarea>
        <p class="node-editor__hint">
          {{ text.trim().length }} / {{ MAX_NODE_TEXT_LENGTH }}
        </p>
        <p
          v-if="textError !== ''"
          id="node-text-error"
          class="node-editor__error"
          data-testid="node-editor-text-error"
        >
          {{ textError }}
        </p>
      </div>

      <div class="node-editor__field">
        <label class="node-editor__label" for="node-title">Title</label>
        <input
          id="node-title"
          v-model="title"
          class="node-editor__input"
          type="text"
          :maxlength="MAX_NODE_TITLE_LENGTH"
          data-testid="node-editor-title"
        />
        <p class="node-editor__hint">
          Optional heading, up to {{ MAX_NODE_TITLE_LENGTH }} characters. When
          empty, a preview of the scene text is shown instead.
        </p>
      </div>

      <div class="node-editor__field">
        <label class="node-editor__label" for="node-color">
          Background color
        </label>
        <div class="node-editor__color-row">
          <input
            id="node-color"
            v-model="backgroundColor"
            class="node-editor__input node-editor__input--color"
            type="text"
            spellcheck="false"
            placeholder="#ffffff"
            data-testid="node-editor-color"
            :aria-invalid="colorValid ? undefined : 'true'"
            :aria-describedby="colorValid ? undefined : 'node-color-error'"
          />
          <button
            type="button"
            class="node-editor__button"
            data-testid="node-editor-color-default"
            @click="applyDefaultColor"
          >
            Reset
          </button>
          <span
            class="node-editor__swatch"
            data-testid="node-editor-swatch"
            :style="{ backgroundColor: colorValid ? backgroundColor : DEFAULT_NODE_BACKGROUND }"
            aria-hidden="true"
          ></span>
        </div>
        <p
          v-if="!colorValid"
          id="node-color-error"
          class="node-editor__error"
          data-testid="node-editor-color-error"
        >
          Use a hex color such as #fff or #aabbcc.
        </p>
      </div>

      <div class="node-editor__preview">
        <p class="node-editor__preview-label">Preview</p>
        <div
          class="node-card"
          data-testid="node-editor-preview"
          :style="{ backgroundColor: colorValid ? backgroundColor : DEFAULT_NODE_BACKGROUND }"
        >
          <h4 class="node-card__title" data-testid="node-editor-preview-title">
            {{ previewHeading }}
          </h4>
          <p class="node-card__text">{{ text }}</p>
        </div>
      </div>

      <div class="node-editor__actions">
        <button
          type="submit"
          class="node-editor__save"
          :disabled="textError !== '' || !colorValid"
          data-testid="node-editor-save"
        >
          Save node
        </button>
        <button type="button" class="node-editor__button" data-testid="node-editor-cancel" @click="onCancel">
          Cancel
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.node-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid #d8dde5;
  border-radius: 8px;
  background: #fafbfd;
}

.node-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.node-editor__heading {
  margin: 0;
  font-size: 1.1rem;
}

.node-editor__node-id {
  color: #5c6470;
  font-weight: 400;
  font-size: 0.85rem;
  font-family: ui-monospace, monospace;
}

.node-editor__form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.node-editor__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.node-editor__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.node-editor__required {
  color: #c0392b;
}

.node-editor__input,
.node-editor__textarea {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  font: inherit;
  background: #fff;
}

.node-editor__input--color {
  font-family: ui-monospace, monospace;
  width: 11rem;
}

.node-editor__invalid {
  border-color: #c0392b;
}

.node-editor__color-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.node-editor__swatch {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 4px;
  border: 1px solid #c9cfda;
}

.node-editor__hint {
  margin: 0;
  color: #5c6470;
  font-size: 0.75rem;
}

.node-editor__error {
  margin: 0;
  color: #c0392b;
  font-size: 0.8rem;
}

.node-editor__preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.node-editor__preview-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: #5c6470;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.node-card {
  border: 1px solid #d8dde5;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.node-card__title {
  margin: 0;
  font-size: 0.95rem;
}

.node-card__text {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: #333;
  white-space: pre-wrap;
}

.node-editor__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.node-editor__save {
  border: none;
  border-radius: 6px;
  background: #2b6cb0;
  color: #fff;
  font: inherit;
  font-weight: 600;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.node-editor__save:disabled {
  background: #a5c6e5;
  cursor: not-allowed;
}

.node-editor__button {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.node-editor__button:hover {
  background: #f2f4f8;
}

.node-editor__close {
  border: none;
  background: none;
  color: #5c6470;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
