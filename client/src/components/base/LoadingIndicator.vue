<script setup lang="ts">

interface Props {
  isLoading?: Boolean
}

const {isLoading = true} = defineProps<Props>()

</script>

<template>
  <div v-if="isLoading" class="loading-container">
    <div class="spinner"></div>
  </div>
</template>

<style scoped>

</style>