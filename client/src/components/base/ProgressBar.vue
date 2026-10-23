<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'

interface Props {
  value: Number,
  label: string
}
const props = defineProps<Props>()

const scale = ref(0);

onMounted(() => {
  requestAnimationFrame(() => {
    scale.value = 1;
  });
});

const percent = computed(() => Math.min(Math.max(props.value, 0), 100))
const percentDisplay = computed(() => `${percent.value}%`)
</script>


<template>
  <div class="progress-wrapper">
    <div class="progress-bar">

      <div class="progress-fill" :style="{ width: percentDisplay, transform: `scaleX(${scale})`}"></div>

      <div class="progress-label">
        {{ percentDisplay }} <span v-if="label"> {{ label }} </span>
      </div>

    </div>
  </div>
</template>



<style scoped>

.progress-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 80%;
}

.progress-bar {
  position: relative;
  width: 100%;
  border: 1px solid var(--material-ui-success);
  background-color: var(--material-ui-success-light);
  border-radius: 4px;
}

.progress-fill {
  height: 1.5rem;
  background-color: var(--material-ui-success);
  transition: transform 0.3s ease;
  transform-origin: left;
}

.progress-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #000;
  pointer-events: none;
  white-space: nowrap;
}

</style>