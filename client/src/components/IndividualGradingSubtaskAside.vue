<script setup lang="ts">
import {computed, inject} from "vue";
import SubtaskPoints from "@/components/SubtaskPoints.vue";
import { useGradingStore } from "@/individual-grading-store";
import {ExamineeSubmissions} from "@/models/ExamineeSubmissions";
import LockedIcon from "@/components/base/LockedIcon.vue";
import {ExamTasksData} from "@/models/ExamTaskData";

interface Props {
  allocatedPoints: number
  subtaskIdentifier: string
  examineeSubmissions: ExamineeSubmissions
  examTasksData: ExamTasksData
}

const props = defineProps<Props>()

const gradingStore = useGradingStore()

const summarizedSubtaskPoints = computed(() => {
  if (props.examineeSubmissions.isNoGradingChosen()) {
    return "-"
  }
  return gradingStore.getSummarizedSubtaskPoints(props.examTasksData, props.subtaskIdentifier).asDisplayableValue()
})

</script>

<template>

  <SubtaskPoints
      :allocated-points="allocatedPoints"
      :achieved-points="summarizedSubtaskPoints">
  </SubtaskPoints>

</template>

<style scoped>

</style>
