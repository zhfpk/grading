<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import {GradingPoints} from "@/models/ExamineeGradingPoints";

interface Props {
  visible: Boolean
  title: string
  confirmText?: string
  cancelText?: string
}
const {visible, title, confirmText = "Confirm", cancelText = "Cancel"} = defineProps<Props>()


const emit = defineEmits(['confirm', 'cancel']);

const onConfirm = () => emit('confirm');
const onCancel = () => emit('cancel');
</script>


<template>

<!--  <div class="modal" v-if="visible">-->
<!--    <div class="modal-content">-->

<!--      <h4>Are you sure you want to submit?}</h4>-->
<!--      <p>After submitting, you <strong>cannot change</strong> any of your submitted answers anymore. Are you sure that you want to submit your exam?")</p>-->
<!--      <p>-->
<!--        <button class="warning large confirm-yes">Yes, submit exam') }}</button>-->
<!--        <button class="ml-2 large confirm-no">No, abort submission') }}</button>-->
<!--      </p>-->
<!--    </div>-->
<!--  </div>-->

  <div v-if="visible" class="vue-modal-overlay">
    <div class="vue-modal-container">
      <div class="vue-modal-content">
        <h4 v-if="title">{{ title }}</h4>
        <slot />
      </div>
      <div class="vue-modal-actions">
        <button @click="onConfirm" class="primary">{{ confirmText }}</button>
        <button @click="onCancel" class="secondary">{{ cancelText }}</button>
      </div>
    </div>
  </div>

</template>


<style scoped>
.vue-modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(5px);
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-start;
  padding-top: 10vh;
  justify-content: center;
  z-index: 1000;
}

.vue-modal-container {
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem;
  width: 100%;
  max-width: 640px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.vue-modal-content {
  padding: 1rem 0;
}

.vue-modal-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

button.primary {
  color: black;
  border: none;
}

button.secondary {
  border: 1px solid var(--border);
}
</style>
