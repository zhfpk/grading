<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import LifecyclePage from "@/views/LifecyclePage.vue";


console.log("Loading LifecycleApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})


</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <LifecyclePage v-else/>
</template>

<style scoped>

</style>