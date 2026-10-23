<script setup lang="ts">

import ApplicationError from "@/components/ApplicationError.vue";
import {computed} from "vue";
import LockedIcon from "@/components/base/LockedIcon.vue";

interface Props {
  submissionValue: string
  isSubmissionLocked?: boolean
  fieldType?: string
  isNoGradingChosen?: boolean
  wordWrapEnabled?: boolean
  useMonospaceFont?: boolean
  visualizeWhitespaces?: boolean
}

const {submissionValue, isSubmissionLocked = false, fieldType = "text", isNoGradingChosen = false, wordWrapEnabled = false, useMonospaceFont = false, visualizeWhitespaces = false} = defineProps<Props>()

const modifiedSubmissionValue = computed(() => {
  if (visualizeWhitespaces === true) {
    return submissionValue.replaceAll(" ", "⌴")
  } else {
    return submissionValue
  }
})

</script>

<template>
  <div>
    <pre class="submission" v-if="isSubmissionLocked" tabindex="-1"><LockedIcon /> <em>You do not have permission to see this submission.</em></pre>
    <template v-if="submissionValue === null">
      <pre class="submission" v-if="fieldType === 'paper'" tabindex="-1"><em><i class="ri-article-line"></i> This is a paper-based task, hence, there is no electronic submission available.</em></pre>
      <pre class="submission" v-else tabindex="-1"><em>⦰ Empty submission (none)</em></pre>
    </template>
    <pre class="submission" v-else-if="(fieldType === 'text' || fieldType === 'tex') && submissionValue === ''" tabindex="-1"><em>⦰ Empty submission (empty string)</em></pre>
    <pre class="submission" v-else-if="fieldType === 'text' || fieldType === 'tex'" tabindex="-1" :class="{'wordwrap': wordWrapEnabled}"><span :class="{'no-grading': isNoGradingChosen, 'sans-font': !useMonospaceFont}">{{ modifiedSubmissionValue }}</span></pre>

    <ApplicationError v-else :message="'Not supported submission field type: ' + fieldType"/>
  </div>
</template>

<style scoped>

</style>