<script setup lang="ts">

import {GradingInput, GradingPoints} from "@/models/ExamineeGradingPoints";
import {GradingType} from "@/models/Enums";

interface Props {
  fieldIdentifier: string
  examineeGradingPoints: GradingPoints
}

defineProps<Props>()

</script>

<template>
  <div class="grading-box-container">
    <div class="grading-box" :class="{'grading-complete': examineeGradingPoints.isDone()}">
      <template v-if="!examineeGradingPoints.isDone()">
        <em>No grading available (you may report this to your examiner)</em>
      </template>
      <template v-else>
        {{ examineeGradingPoints.toGradingInput().toSummary(true) }}
      </template>
    </div>

    <div class="subtask-field-identifier-box smaller">
      Field name: <span class="verb">{{ fieldIdentifier }}</span>
    </div>
  </div>

</template>

<style scoped>

</style>