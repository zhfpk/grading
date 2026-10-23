<script setup lang="ts">

interface Props {
  type: string
  showTitle?: boolean
}

const { type, showTitle = true } = defineProps<Props>()

</script>

<template>
  <div :class="'message-' + type" class="message-container">
    <template v-if="showTitle">
      <strong v-if="type === 'info'">
        Note
      </strong>
      <strong v-else-if="type === 'warn'">
        Warning
      </strong>
      <strong v-if="type === 'error'">
        Error
      </strong>
      <strong v-if="type === 'success'">
        Success
      </strong>
    </template>
    <slot></slot>
  </div>
</template>

<style scoped>

.message-container {
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid gray;
  border-radius: 5px;
}

.message-warn {
  border-color: var(--material-ui-warning);
}

.message-error {
  border-color: var(--material-ui-error);
}

.message-info {
  border-color: var(--material-ui-info);
}

.message-success {
  border-color: var(--material-ui-success);
}

strong {
  padding-right: 1rem;
}

</style>