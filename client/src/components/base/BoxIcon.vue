<script setup lang="ts">

interface Props {
  ticked: boolean
}

defineProps<Props>()

</script>

<template>
  <template v-if="ticked">&#9746;</template>
  <template v-if="!ticked">&#9744;</template>
</template>

<style scoped>

</style>