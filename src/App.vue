<script setup lang="ts">
import StoryList from '@/components/StoryList.vue';
</script>

<template>
  <main>
    <h1>Interactive Story Builder</h1>
    <StoryList />
  </main>
</template>

<style>
main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: system-ui, sans-serif;
}

h1 {
  margin: 0 0 1rem;
  font-size: 1.6rem;
}
</style>
