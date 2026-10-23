<script setup lang="ts">

import {GradingPoints} from "@/models/ExamineeGradingPoints";
import {inject, onMounted} from "vue";
import ExamApi from "@/models/ExamApi";

interface Props {
  examineeGradingPoints: Array<GradingPoints>
  totalSubmissionCount: number
}
defineProps<Props>()

// note: we only have the anonymized name here (extracted from the examinee identifier)
// > the rationale here is that this is group grading, therefore there is probably no case where the non-anonymized name would be needed here
// > the non-anoymized name of an examinee should only be relevant in the content of the individual grading

const examApi: ExamApi = inject("examApi")

</script>

<template>
  <details class="small" tabindex="-1">
    <summary>Found {{ examineeGradingPoints.length }}x ({{ ((examineeGradingPoints.length / totalSubmissionCount)*100).toFixed(1) }}%)</summary>
    <div>
      <template v-for="(gradingPoints, index) in examineeGradingPoints" :key="item">
        <a :href="examApi.buildIndividualGradingURL(gradingPoints.examineeIdentifier)">
          {{ gradingPoints.examineeIdentifier.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') }}
        </a>

<!--        <a @click="gotoIndividualGrading(gradingPoints.examineeIdentifier)" class="link">-->
<!--{{ gradingPoints.examineeIdentifier.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') }}-->
<!--        </a>-->
        <span v-if="index < examineeGradingPoints.length - 1">, </span>
      </template>
    </div>
  </details>
</template>

<style scoped>
ul {
  padding-left: 0;
}
</style>