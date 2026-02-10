<script setup lang="ts">
import { ref } from 'vue';
import StoryList from '@/components/StoryList.vue';
import CreateStoryForm from '@/components/CreateStoryForm.vue';
import type { StorySummary } from '@/types/story';

// Bumped after a story is created; re-keys the list so it re-reads storage.
const listVersion = ref(0);

function onStoryCreated(_summary: StorySummary) {
  listVersion.value += 1;
}
</script>

<template>
  <main>
    <h1>Interactive Story Builder</h1>
    <CreateStoryForm @created="onStoryCreated" />
    <StoryList :key="listVersion" />
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
