<script setup lang="ts">
import { ref } from 'vue';
import { importStoryFromFile } from '@/lib/importStory';

const emit = defineEmits<{
  /** Emitted with the imported story's id after a successful import. */
  (e: 'imported', storyId: string): void;
}>();

const fileName = ref('');
const importing = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  successMessage.value = '';
  errorMessage.value = '';
  if (file === undefined || file === null) return;

  fileName.value = file.name;
  importing.value = true;

  importStoryFromFile(file).then((result) => {
    importing.value = false;
    if (result.ok) {
      successMessage.value = `Imported "${result.story.title}". It now appears in your list below.`;
      input.value = '';
      fileName.value = '';
      emit('imported', result.story.id);
    } else {
      errorMessage.value = result.error;
    }
  });
}
</script>

<template>
  <section class="import-story" aria-label="Import a story from JSON">
    <h2 class="import-story__heading">Import a story from JSON</h2>
    <p v-if="successMessage" class="import-story__success" data-testid="import-story-success">
      {{ successMessage }}
    </p>
    <form class="import-story__form" novalidate @submit.prevent="() => {}">
      <div class="field">
        <label class="field__label" for="story-import-file">
          Story JSON file <span class="field__required" aria-hidden="true">*</span>
        </label>
        <input
          id="story-import-file"
          class="field__input"
          type="file"
          accept="application/json,.json"
          required
          data-testid="import-story-file"
          :aria-invalid="errorMessage.length > 0"
          :aria-describedby="errorMessage.length > 0 ? 'import-story-error' : undefined"
          @change="onFileChange"
        />
      </div>
      <p v-if="errorMessage" id="import-story-error" class="field__error" data-testid="import-story-error">
        {{ errorMessage }}
      </p>
      <p class="import-story__note">
        Choose a file previously exported from this app. Importing a story with the same id replaces the existing copy.
      </p>
    </form>
  </section>
</template>

<style scoped>
.import-story {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid #d8dde5;
  border-radius: 8px;
  background: #fafbfd;
}

.import-story__heading {
  margin: 0;
  font-size: 1.15rem;
}

.import-story__success {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #e5f5ea;
  color: #1d6b3a;
  font-size: 0.9rem;
}

.import-story__form {
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
  padding: 0.4rem 0.55rem;
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

.import-story__note {
  margin: 0;
  color: #5c6470;
  font-size: 0.78rem;
}
</style>
