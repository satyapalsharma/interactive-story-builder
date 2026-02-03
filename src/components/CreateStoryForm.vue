<script setup lang="ts">
import { ref } from 'vue';
import {
  createNewStory,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type NewStoryInputError,
} from '@/lib/createStory';
import type { StorySummary } from '@/types/story';

const props = defineProps<{
  /** Called with the created summary after a successful save. */
  onCreated?: (summary: StorySummary) => void;
}>();

const title = ref('');
const author = ref('');
const description = ref('');
const fieldErrors = ref<Partial<Record<'title' | 'author' | 'description', string>>>({});
const justCreated = ref(false);

function setError(field: 'title' | 'author' | 'description', msg: string | undefined) {
  if (msg) {
    fieldErrors.value[field] = msg;
  } else {
    delete fieldErrors.value[field];
  }
}

async function onSubmit() {
  justCreated.value = false;
  const result = createNewStory({
    title: title.value,
    author: author.value,
    description: description.value,
  });

  if (!result.ok) {
    for (const err of result.errors as NewStoryInputError[]) {
      setError(err.field, err.message);
    }
    return;
  }

  fieldErrors.value = {};
  title.value = '';
  author.value = '';
  description.value = '';
  justCreated.value = true;
  props.onCreated?.(result.summary);
}
</script>

<template>
  <section class="create-story" aria-label="Create a new story">
    <h2 class="create-story__heading">Create a new story</h2>
    <p v-if="justCreated" class="create-story__success" data-testid="create-story-success">
      Story created. It now appears in your list below.
    </p>
    <form class="create-story__form" novalidate @submit.prevent="onSubmit">
      <div class="field">
        <label class="field__label" for="story-title">
          Title <span class="field__required" aria-hidden="true">*</span>
        </label>
        <input
          id="story-title"
          v-model="title"
          class="field__input"
          type="text"
          maxlength="200"
          required
          autocomplete="off"
          data-testid="create-story-title"
          :aria-invalid="Boolean(fieldErrors.title)"
          :aria-describedby="fieldErrors.title ? 'story-title-error' : undefined"
        />
        <p v-if="fieldErrors.title" id="story-title-error" class="field__error" data-testid="create-story-title-error">
          {{ fieldErrors.title }}
        </p>
      </div>

      <div class="field">
        <label class="field__label" for="story-author">Author</label>
        <input
          id="story-author"
          v-model="author"
          class="field__input"
          type="text"
          autocomplete="off"
          data-testid="create-story-author"
          :aria-invalid="Boolean(fieldErrors.author)"
          :aria-describedby="fieldErrors.author ? 'story-author-error' : undefined"
        />
        <p v-if="fieldErrors.author" id="story-author-error" class="field__error" data-testid="create-story-author-error">
          {{ fieldErrors.author }}
        </p>
      </div>

      <div class="field">
        <label class="field__label" for="story-description">Description</label>
        <textarea
          id="story-description"
          v-model="description"
          class="field__input"
          rows="3"
          autocomplete="off"
          data-testid="create-story-description"
          :aria-invalid="Boolean(fieldErrors.description)"
          :aria-describedby="fieldErrors.description ? 'story-description-error' : undefined"
        ></textarea>
        <p
          class="field__hint"
          :class="{ 'field__hint--warn': description.length > MAX_DESCRIPTION_LENGTH }"
        >
          {{ description.length }} / {{ MAX_DESCRIPTION_LENGTH }}
        </p>
        <p v-if="fieldErrors.description" id="story-description-error" class="field__error" data-testid="create-story-description-error">
          {{ fieldErrors.description }}
        </p>
      </div>

      <div class="create-story__actions">
        <button class="create-story__submit" type="submit" data-testid="create-story-submit">
          Create story
        </button>
        <span class="create-story__note">
          A starter node will be created for you.
        </span>
      </div>
      <p v-if="fieldErrors.title || fieldErrors.author || fieldErrors.description" class="create-story__required-note">
        A title (up to {{ MAX_TITLE_LENGTH }} characters) is required.
      </p>
    </form>
  </section>
</template>

<style scoped>
.create-story {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid #d8dde5;
  border-radius: 8px;
  background: #fafbfd;
}

.create-story__heading {
  margin: 0;
  font-size: 1.15rem;
}

.create-story__success {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #e5f5ea;
  color: #1d6b3a;
  font-size: 0.9rem;
}

.create-story__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.field__required {
  color: #c0392b;
}

.field__input {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  font: inherit;
}

.field__input[aria-invalid='true'] {
  border-color: #c0392b;
}

.field__error {
  margin: 0;
  color: #c0392b;
  font-size: 0.8rem;
}

.field__hint {
  margin: 0;
  color: #5c6470;
  font-size: 0.75rem;
  text-align: right;
}

.field__hint--warn {
  color: #c0392b;
}

.create-story__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.create-story__submit {
  border: none;
  border-radius: 6px;
  background: #2b6cb0;
  color: #fff;
  font: inherit;
  font-weight: 600;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.create-story__submit:hover {
  background: #255d94;
}

.create-story__note {
  color: #5c6470;
  font-size: 0.78rem;
}

.create-story__required-note {
  margin: 0;
  color: #c0392b;
  font-size: 0.8rem;
}
</style>
