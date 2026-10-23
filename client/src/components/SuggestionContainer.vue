<script setup lang="ts">

import {computed, defineEmits, ref, toRefs, watch} from "vue";

interface Props {
  currentInput: string
  suggestions: string[]
}

const props = defineProps<Props>()
const { currentInput, suggestions } = toRefs(props)

const emit = defineEmits(['selected']);

const shown = ref<Boolean>(true)
const activeIdx = ref(-1)

const matchingSuggestions = computed(() => {
  if (!Array.isArray(suggestions.value)) {
    return []
  }
  let r = suggestions.value.filter(suggestion => {
    return suggestion !== currentInput.value && suggestion.includes(currentInput.value)
  })
  console.log("matching suggestions", r)
  return r
})

const onArrowDown = () => {
  console.log("on arrow down is triggered")
  if (matchingSuggestions.value.length > 0) {
    activeIdx.value = (activeIdx.value + 1) % matchingSuggestions.value.length
    shown.value = true
  }
}

const onArrowUp = () => {
  console.log("on arrow up is triggered")
  if (matchingSuggestions.value.length > 0) {
    activeIdx.value = (activeIdx.value - 1 + matchingSuggestions.value.length) % matchingSuggestions.value.length
    shown.value = true
  }
}

const onEnter = () => {
  console.log("on enter is triggered")
  if (shown.value === true && activeIdx.value >= 0 && activeIdx.value < matchingSuggestions.value.length) {
    console.log("triggering emit for selected:", matchingSuggestions.value[activeIdx.value])
    emit('selected', matchingSuggestions.value[activeIdx.value])
  }
  shown.value = false
}

const onEscape = () => {
  console.log("on escape is triggered")
  activeIdx.value = -1
  shown.value = false
}

defineExpose({
  onArrowDown, onEnter, onArrowUp, onEscape
})

</script>

<template>
  <div v-if="matchingSuggestions.length > 0 && shown === true" class="suggestions">
    <div v-for="(suggestion, suggestionIndex) in matchingSuggestions"
         class="suggestion-item"
         @mousedown="onEnter"
         @mouseover="activeIdx=suggestionIndex"
         :class="{'suggestion-active': suggestionIndex === activeIdx}">
      {{ suggestion }}
    </div>
  </div>
</template>

<style scoped>
.suggestions {
    position: absolute;
    left: 0;
    right: 0;
    margin-top: 2px;
    background-color: var(--bg);
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 10;
    max-height: 16rem;
    overflow-y: auto;
}

.suggestion-item {
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
}

.suggestion-active {
    background-color: #3b82f6;
    color: #ffffff;
}



</style>