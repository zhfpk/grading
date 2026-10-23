<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import GraderInvitationPage from "@/views/GraderInvitationPage.vue";
import {AppError} from "@/models/AppError";

console.log("Loading GraderInvitationApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})

</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <GraderInvitationPage v-else/>
</template>

<style scoped>

</style>
