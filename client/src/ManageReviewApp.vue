<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import ManageReviewPage from "@/views/ManageReviewPage.vue";


console.log("Loading ManageReviewApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})


</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <ManageReviewPage v-else/>
</template>

<style scoped>

</style>