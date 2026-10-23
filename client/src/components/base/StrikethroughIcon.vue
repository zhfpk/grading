<script setup lang="ts">

interface Props {
  title?: string,
  color?: string
}

defineProps<Props>()

</script>

<template>
  <i class="ri-strikethrough" :title="title" :class="color"></i>
</template>

<style scoped>

.red {
  color: red;
}

</style>