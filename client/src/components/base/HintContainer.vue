<script setup lang="ts">

import {useSlots} from "vue";

const slots = useSlots()
const hasDefaultSlot = !!slots.default

</script>

<template>
  <span class="info-container" v-if="hasDefaultSlot">
    <span class="info-icon"><span class="ri-information-line"></span></span>
    <span class="info-box">
      <slot></slot>
    </span>
  </span>
</template>

<style scoped>

</style>