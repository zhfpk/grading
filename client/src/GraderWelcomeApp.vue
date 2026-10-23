<script setup>

import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import GraderWelcomePage from "@/views/GraderWelcomePage.vue";

console.log("Loading GraderWelcomeApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})


</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <GraderWelcomePage v-else/>
</template>

<style scoped>

</style>
