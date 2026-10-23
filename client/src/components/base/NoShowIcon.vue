<script setup lang="ts">

interface Props {
  title?: string,
  color?: string
}

defineProps<Props>()

</script>

<template>
  <i class="ri-user-minus-line" :title="title" :class="color"></i>
</template>

<style scoped>

</style>