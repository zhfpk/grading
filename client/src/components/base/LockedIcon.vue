<script setup lang="ts">

interface Props {
  title?: string
}

const { title = "Locked" } = defineProps<Props>()

</script>

<template>
  <i class="ri-lock-line" :title="title"></i>
</template>

<style scoped>

</style>