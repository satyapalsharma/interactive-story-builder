<script setup lang="ts">
import { ref } from 'vue';
import {
  nodeBackground,
  nodeHeading,
} from '@/lib/nodeContent';
import {
  createReaderState,
  goBack,
  restartReader,
  takeChoice,
  type ReaderState,
} from '@/lib/storyReader';
import type { Story } from '@/types/story';

const props = defineProps<{
  story: Story;
}>();

const emit = defineEmits<{
  /** The reader was dismissed (close button); nothing was changed. */
  (e: 'close'): void;
}>();

const initialState = createReaderState(props.story.nodes);
const reader = ref<ReaderState | undefined>(
  initialState.ok ? initialState.state : undefined,
);
const readerError = ref(initialState.ok ? '' : initialState.error);

function applyChoice(choiceId: string) {
  if (reader.value === undefined) return;
  const result = takeChoice(props.story.nodes, reader.value, choiceId);
  if (result.ok) {
    reader.value = result.state;
    readerError.value = '';
  } else {
    readerError.value = result.error;
  }
}

function onGoBack() {
  if (reader.value === undefined) return;
  const result = goBack(props.story.nodes, reader.value);
  if (result.ok) {
    reader.value = result.state;
    readerError.value = '';
  } else {
    readerError.value = result.error;
  }
}

function onRestart() {
  if (reader.value === undefined) return;
  const result = restartReader(props.story.nodes, reader.value);
  if (result.ok) {
    reader.value = result.state;
    readerError.value = '';
  } else {
    readerError.value = result.error;
  }
}
</script>

<template>
  <section
    class="story-reader"
    :aria-label="`Reading ${story.title}`"
    data-testid="story-reader"
  >
    <header class="story-reader__header">
      <div>
        <h2 class="story-reader__title" data-testid="story-reader-title">
          {{ story.title }}
        </h2>
        <p class="story-reader__author">by {{ story.author }}</p>
      </div>
      <button
        type="button"
        class="story-reader__close"
        data-testid="story-reader-close"
        @click="emit('close')"
      >
        Close reader
      </button>
    </header>

    <template v-if="reader">
      <article
        class="story-reader__scene"
        :class="{ 'story-reader__scene--end': reader.current.atEnd }"
        :style="{ backgroundColor: nodeBackground(reader.current.node) }"
        :data-testid="`story-reader-scene-${reader.current.node.id}`"
      >
        <h3 class="story-reader__scene-heading">
          {{ nodeHeading(reader.current.node) }}
        </h3>
        <p class="story-reader__scene-text" data-testid="story-reader-text">
          {{ reader.current.node.text }}
        </p>
      </article>

      <div v-if="reader.current.atEnd" class="story-reader__end" data-testid="story-reader-end">
        <p data-testid="story-reader-end-message">
          The end. You have reached the final scene of this branch.
        </p>
        <div class="story-reader__end-actions">
          <button
            type="button"
            class="story-reader__restart"
            data-testid="story-reader-restart-end"
            @click="onRestart"
          >
            Read again from the start
          </button>
        </div>
      </div>

      <div v-else class="story-reader__choices" data-testid="story-reader-choices">
        <p class="story-reader__choices-label">What do you do next?</p>
        <div class="story-reader__choice-list">
          <button
            v-for="choice in reader.current.choices"
            :key="choice.id"
            type="button"
            class="story-reader__choice"
            :data-testid="`story-reader-choice-${choice.id}`"
            :aria-label="`Choose ${choice.label}`"
            @click="applyChoice(choice.id)"
          >
            {{ choice.label }}
          </button>
        </div>
      </div>

      <p
        v-if="readerError !== ''"
        class="story-reader__error"
        data-testid="story-reader-error"
        role="alert"
      >
        {{ readerError }}
      </p>

      <footer class="story-reader__controls">
        <button
          type="button"
          class="story-reader__back"
          :disabled="reader.history.length === 0"
          :data-testid="
            reader.history.length === 0
              ? 'story-reader-back-disabled'
              : 'story-reader-back'
          "
          @click="onGoBack"
        >
          &larr; Back
        </button>
        <span class="story-reader__progress">
          Scene {{ reader.history.length + 1 }}
        </span>
        <button
          type="button"
          class="story-reader__restart"
          data-testid="story-reader-restart"
          @click="onRestart"
        >
          Restart
        </button>
      </footer>
    </template>

    <template v-else>
      <p class="story-reader__empty" data-testid="story-reader-empty">
        {{ readerError }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.story-reader {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.story-reader__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.story-reader__title {
  margin: 0;
  font-size: 1.3rem;
}

.story-reader__author {
  margin: 0.15rem 0 0;
  color: #5c6470;
  font-size: 0.85rem;
}

.story-reader__close {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.story-reader__scene {
  border: 1px solid #d8dde5;
  border-radius: 8px;
  padding: 1rem 1.25rem;
}

.story-reader__scene--end {
  border-color: #2b6cb0;
}

.story-reader__scene-heading {
  margin: 0;
  font-size: 1.05rem;
}

.story-reader__scene-text {
  margin: 0.4rem 0 0;
  font-size: 0.95rem;
  white-space: pre-wrap;
  color: #222;
}

.story-reader__end {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #e5f5ea;
  color: #1d6b3a;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.story-reader__end p {
  margin: 0;
}

.story-reader__choices {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.story-reader__choices-label {
  margin: 0;
  color: #5c6470;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.story-reader__choice-list {
  display: grid;
  gap: 0.5rem;
}

.story-reader__choice {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 0.9rem;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  text-align: left;
}

.story-reader__choice:hover {
  background: #f2f4f8;
  border-color: #2b6cb0;
}

.story-reader__error {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #fdecec;
  color: #c0392b;
  font-size: 0.85rem;
}

.story-reader__controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.25rem;
  border-top: 1px solid #e2e6ee;
}

.story-reader__back,
.story-reader__restart {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.story-reader__back:disabled {
  color: #9aa3b2;
  cursor: not-allowed;
  background: #f5f7fa;
}

.story-reader__progress {
  color: #5c6470;
  font-size: 0.8rem;
}

.story-reader__empty {
  color: #5c6470;
  font-size: 0.9rem;
}
</style>
