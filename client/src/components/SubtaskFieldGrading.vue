<script setup lang="ts">

import {useGradingStore, useSettingsStore} from "@/individual-grading-store.js";
import {Submission} from "@/models/ExamineeSubmissions";
import SubmissionContainer from "@/components/SubmissionContainer.vue";
import GradingInputContainer from "@/components/GradingInputContainer.vue";
import LockedIcon from "@/components/base/LockedIcon.vue";
import BoxIcon from "@/components/base/BoxIcon.vue";
import {GradingType} from "@/models/Enums";
import StrikethroughIcon from "@/components/base/StrikethroughIcon.vue";
import GradingDisplayContainer from "@/components/GradingDisplayContainer.vue";

interface Props {
  fieldIdentifier: string
  subtaskIdentifier: string
  label: string
  fieldType: string
  submission: Submission
  isNoGradingChosen: boolean
  examPhase: string
}

const props = defineProps<Props>()

const gradingStore = useGradingStore()
const settingsStore = useSettingsStore()

const isSubmissionLocked = props.submission !== null && props.submission.isLocked()
const submissionValue = props.submission !== null ? props.submission.submittedValue : null
</script>

<template>
  <span v-html="label"></span>

  <SubmissionContainer
      :submission-value="submissionValue"
      :is-submission-locked="isSubmissionLocked"
      :field-type="fieldType"
      :isNoGradingChosen="isNoGradingChosen"
      :visualize-whitespaces="settingsStore.visibleWhitespaces"
      :use-monospace-font="settingsStore.useMonospaceFont"
      :word-wrap-enabled="settingsStore.wordWrapEnabled">
  </SubmissionContainer>

  <div class="grading-box-container grading-box grading-complete" v-if="isSubmissionLocked || (gradingStore.getGradingPoints(props.fieldIdentifier).isPointsLocked() && gradingStore.getGradingPoints(props.fieldIdentifier).isAnnotationLocked())">
    <LockedIcon /> <em>You do not have permission to access the grading of this submission.</em>
  </div>
  <div class="grading-box-container grading-box grading-complete" v-else-if="isNoGradingChosen">
    <StrikethroughIcon /> <em>Examinee decided to submit blank for the entire exam (no-grading is active).</em>
  </div>
  <GradingDisplayContainer v-else-if="!gradingStore.getGradingPoints(props.fieldIdentifier).isPointsLocked() && gradingStore.getGradingPoints(props.fieldIdentifier).isAnnotationLocked()"
                           :field-identifier="fieldIdentifier"
                           :examinee-grading-points="gradingStore.getGradingPoints(props.fieldIdentifier)"></GradingDisplayContainer>

  <GradingInputContainer v-else
      :field-identifier="fieldIdentifier"
      :exam-phase="examPhase"
      :grading-type="GradingType.INDIVIDUAL_GRADING"
      :examinee-grading-points="[gradingStore.getGradingPoints(props.fieldIdentifier)]">
  </GradingInputContainer>

</template>

<style scoped>

</style>