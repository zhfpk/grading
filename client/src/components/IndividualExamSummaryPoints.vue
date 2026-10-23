<script setup lang="ts">

import {useGradingStore} from "@/individual-grading-store.js";
import {ExamTasksData} from "@/models/ExamTaskData";
import LockedIcon from "@/components/base/LockedIcon.vue";
import BoxIcon from "@/components/base/BoxIcon.vue";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import {ref} from "vue";
import {LocalStorageSettings} from "@/models/Enums";
import AnnotationsIcon from "@/components/base/AnnotationsIcon.vue";

interface Props {
  examTasksData: ExamTasksData
  examGradeCalculation: ExamGradeCalculation
}

const props = defineProps<Props>()

const gradingStore = useGradingStore()

const keepPointsOpen = ref<boolean>(window.localStorage.getItem(LocalStorageSettings.UI_INDIVIDUAL_KEEP_POINTS_OPEN) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_INDIVIDUAL_KEEP_POINTS_OPEN) == 'true' : false)

function summarizedSubtaskPoints(subtaskName: string) {
  return gradingStore.getSummarizedSubtaskPoints(props.examTasksData, subtaskName)
}

function summarizedExamPoints() {
  return gradingStore.getSummarizedExamPoints(props.examTasksData, props.examGradeCalculation)
}

function scrollToSubtask(subtaskName: string) {
  let subtaskContainer = document.getElementById("subtask-" + subtaskName)
  if (subtaskContainer) {
    subtaskContainer.scrollIntoView({behavior: "smooth"})
  }
}

const onKeepPointsOpenClick = () => {
  window.localStorage.setItem(LocalStorageSettings.UI_INDIVIDUAL_KEEP_POINTS_OPEN, keepPointsOpen.value === true ? 'true' : 'false')
}

</script>

<template>
  <details class="small" :open="keepPointsOpen">
    <summary>
      Points
      <span v-if="summarizedExamPoints().allPointsLocked">
        &mdash; <LockedIcon /> Insufficient permissions
      </span>
      <template v-else>
        &mdash; Achieved: {{ summarizedExamPoints().achievedPoints }}
        <sup class="info" v-if="summarizedExamPoints().somePointsLocked">[1]</sup>
        <template v-else>
          <span v-if="summarizedExamPoints().allGradingsDone">
            &mdash; Grade {{ summarizedExamPoints().achievedGrade }}
          </span>
          <span v-else>
            ({{ summarizedExamPoints().achievedGrade }}) &mdash; Possible: &le; {{ summarizedExamPoints().possiblePoints }} ({{ summarizedExamPoints().possibleGrade }}) &mdash;
            <span class="error">
              Grading pending
            </span>
          </span>
        </template>
        <span v-if="summarizedExamPoints().withInternalAnnotations">
          &mdash; <span>Annotated</span>
        </span>
        <span v-if="summarizedExamPoints().inconsistentGradings">
          &mdash; <span class="error">Inconsistent points</span>
        </span>
      </template>
    </summary>
    <div>
      <ul class="my-0">
        <li v-for="subtask in examTasksData.getSubtasks()">
          <a class="link" @click="scrollToSubtask(subtask.name)">{{ subtask.name }}</a>:
          {{ summarizedSubtaskPoints(subtask.name).asDisplayableValue() }} / {{ subtask.points }}
          <span v-if="summarizedSubtaskPoints(subtask.name).allPointsLocked" class="info">
            <LockedIcon /> Insufficient permissions to view any gradings.
          </span>
          <span v-else-if="summarizedSubtaskPoints(subtask.name).somePointsLocked" class="info">
            <LockedIcon /> Insufficient permissions to view gradings of some fields.
          </span>
          <span v-else-if="!summarizedSubtaskPoints(subtask.name).allGradingsDone">
            &mdash; <span class="error">Grading pending</span>
          </span>
          <span v-if="summarizedSubtaskPoints(subtask.name).withInternalAnnotations">
            &mdash; <span><AnnotationsIcon/> Annotated</span>
          </span>
          <span v-if="summarizedSubtaskPoints(subtask.name).summarizedPoints > subtask.points">
            &mdash; <span class="error">Inconsistent points</span>
          </span>
        </li>
      </ul>
      <p v-if="summarizedExamPoints().somePointsLocked">
        <span class="info">[1]</span> Some of the examinee's gradings cannot be accessed due to insufficient permissions. Therefore, only the accessible points are summed up. Actual points may differ.
      </p>
      <div class="text-align-right keep-open-container">
        <span>Keep open</span> <input @change="onKeepPointsOpenClick" type="checkbox" id="keepPointsOpen" v-model="keepPointsOpen">
      </div>
    </div>
  </details>

</template>

<style scoped>

</style>