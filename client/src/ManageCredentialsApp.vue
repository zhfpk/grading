<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import ManageCredentialsPage from "@/views/ManageCredentialsPage.vue";

console.log("Loading ManageCredentialsApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})

</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <ManageCredentialsPage v-else/>
</template>

<style scoped>

</style>
