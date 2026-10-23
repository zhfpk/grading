<script setup>
import {onErrorCaptured, onMounted, ref} from "vue";
import ApplicationError from "@/components/ApplicationError.vue";
import GroupGradingPage from "@/views/GroupGradingPage.vue";
import ManageGradersPage from "@/views/ManageGradersPage.vue";
import PointsAndGradesPage from "@/views/PointsAndGradesPage.vue";

console.log("Loading ManageGradersApp ...")

const caughtException = ref(null)

onErrorCaptured( (err, instance, info) => {
  console.error(err)
  caughtException.value = err
  return false
})


</script>

<template>
  <ApplicationError v-if="caughtException !== null" :exception="caughtException"/>
  <PointsAndGradesPage v-else/>
</template>

<style scoped>

</style>