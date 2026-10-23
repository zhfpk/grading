<script setup lang="ts">

import {computed, defineEmits, defineProps, getCurrentInstance, useSlots} from "vue";
import HintContainer from "@/components/base/HintContainer.vue";

interface Props {
  description: string
  activated: boolean
  hotKey?: string
  localStorageEntry?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:'): void
}>()

if (props.hotKey !== null) {
  document.addEventListener('keydown', (event) => {
    if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') return;
    if (event.key === props.hotKey) {
      document.querySelector("input#" + customFieldId.value).click()
    }
  })
}

const customFieldId = computed(() => {
  return 'settings-toggle-' + getCurrentInstance().uid
})

const slots = useSlots()
const hasDefaultSlot = !!slots.default

function onChange(event) {
  emit('update:activated', event.target.checked)
  if (props.localStorageEntry != null) {
    window.localStorage.setItem(props.localStorageEntry, event.target.checked.toString())
  }
}

</script>

<template>
  <div class="my-0">
    <input :id="customFieldId" type="checkbox" @change="e => onChange(e)" class="toggle-switch" :checked="activated"/>
    <label :for="customFieldId" class="toggle-switch" :title="description">

    </label>
    {{ description }}

    <HintContainer v-if="hasDefaultSlot">
      <slot></slot>
    </HintContainer>
  </div>
</template>

<style scoped>

</style>