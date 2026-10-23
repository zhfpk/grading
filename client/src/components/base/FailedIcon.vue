<script setup lang="ts">

interface Props {
  title?: string
}

defineProps<Props>()

</script>

<template>
  <i class="ri-close-large-fill error" :title="title"></i>
</template>

<style scoped>

</style>