<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import GroupGradingPage from "@/views/GroupGradingPage.vue";

console.log("Loading GroupGradingApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})


</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <GroupGradingPage v-else/>
</template>

<style scoped>

</style>