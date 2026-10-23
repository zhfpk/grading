<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import OverviewPage from "@/views/OverviewPage.vue";

console.log("Loading OverviewApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})

</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <OverviewPage v-else/>
</template>

<style scoped>

</style>
