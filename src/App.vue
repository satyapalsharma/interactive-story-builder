<script setup lang="ts">
import { computed, ref } from 'vue';
import StoryList from '@/components/StoryList.vue';
import CreateStoryForm from '@/components/CreateStoryForm.vue';
import StoryEditorView from '@/components/StoryEditorView.vue';
import { storyStorage } from '@/lib/storyStorage';
import type { Story, StorySummary } from '@/types/story';

// Bumped after a story is created or edited; re-keys the list so it re-reads storage.
const listVersion = ref(0);

// Story whose node editor is currently open, or null when the list is shown.
const editingStoryId = ref<string | null>(null);
const editingStory = computed<Story | null>(() => {
  if (editingStoryId.value === null) return null;
  return storyStorage.getStory(editingStoryId.value) ?? null;
});

function onStoryCreated(_summary: StorySummary) {
  listVersion.value += 1;
}

function onOpenStory(storyId: string) {
  editingStoryId.value = storyId;
}

function onCloseEditor() {
  editingStoryId.value = null;
}
</script>

<template>
  <main>
    <h1>Interactive Story Builder</h1>
    <template v-if="editingStory !== null">
      <StoryEditorView
        :story="editingStory"
        @updated="listVersion += 1"
        @close="onCloseEditor"
      />
    </template>
    <template v-else>
      <CreateStoryForm @created="onStoryCreated" />
      <StoryList :key="listVersion" @open="onOpenStory" />
    </template>
  </main>
</template>

<style>
main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: system-ui, sans-serif;
}

main > * {
  margin-bottom: 1.25rem;
}

h1 {
  margin: 0 0 1rem;
  font-size: 1.6rem;
}
</style>
