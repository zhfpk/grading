<script setup lang="ts">

interface Props {
  title?: string,
  color?: string,
  completed: boolean
}

defineProps<Props>()

</script>

<template>
  <i :class="{'ri-checkbox-circle-line': completed, 'ri-checkbox-blank-circle-line': !completed, color} " :title="title"></i>
</template>

<style scoped>

</style>