<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  text: string
  icon: string
  hint?: string
}

const { text, icon = "ri-clipboard-line", hint="" } = defineProps<Props>()

const copied = ref(false)

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch (err) {
    copied.value = false
  }
}
</script>

<template>
  <div class="clipboard-container">
    <div class="clickable" @click="copyToClipboard">
      <i :class="icon" title="Copy to clipboard"></i> <span v-if="hint.length > 0">{{ hint }}</span>
    </div>

    <div v-if="copied" class="copied-popup">
      Copied to clipboard!
    </div>
  </div>
</template>

<style scoped>
.clipboard-container {
  position: relative;
  display: inline-block;
}

i {
  font-size: 105%;
}

.copied-popup {
  position: absolute;
  top: -35px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #323232;
  color: #efefef;
  font-size: 0.9rem;
  padding: 0.5rem 0.6rem;
  border-radius: 4px;
  white-space: nowrap;
}

</style>