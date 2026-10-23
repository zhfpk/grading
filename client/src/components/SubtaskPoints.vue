<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
  allocatedPoints: number
  achievedPoints: string
}>()

const isGradingConsistent = computed(() => {
  let matchingDigits = props.achievedPoints.match("[0-9]+")
  if (matchingDigits !== null) {
    let pointsInteger = Number.parseInt(matchingDigits)
    return pointsInteger <= props.allocatedPoints
  }
  return true
})
</script>

<template>
  <strong :class="{'error': !isGradingConsistent}">
    {{ achievedPoints }} / {{ allocatedPoints }}&nbsp;
    <span v-if="allocatedPoints > 1">Points</span>
    <span v-else>Point</span>
  </strong>

</template>

<style scoped>

</style>