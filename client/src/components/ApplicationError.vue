<script setup lang="ts">
import {AppError} from "@/models/AppError";

interface Props {
  exception?: Error
  message?: string
}

defineProps<Props>()

</script>

<template>
  <div class="errorContainer">
    <p class="errorText" v-if="exception">
      There was a critical error that caused the app to stop working entirely.
    </p>
    <p class="errorText" v-else>
      An error occurred while loading the application.
    </p>
    <p class="errorText">
      Error message:
      <em v-if="exception instanceof AppError">
        {{ exception.message }}
      </em>
      <em v-else-if="message">
        {{ message }}
      </em>
      <em v-else>
        (no error message available)
      </em>
    </p>
  </div>
</template>

<style scoped>

</style>