<script setup lang="ts">

import {computed, nextTick, onMounted, ref} from "vue";

interface Props {
  hidden?: boolean
}

const { hidden = true } = defineProps<Props>()

const isHidden = ref(hidden)

</script>

<template>
  <slot v-if="!isHidden"></slot>
  <em v-else>&laquo;hidden&raquo;</em>
  <span @click="isHidden=!isHidden" class="clickable hidable-action">&nbsp;
    <i :class="{'ri-eye-off-fill': isHidden, 'ri-eye-fill': !isHidden}" title="Click to show/hide content."></i>
    <template v-if="isHidden">&nbsp;Show</template>
    <template v-else>&nbsp;Hide</template>
  </span>
</template>

<style scoped>

</style>