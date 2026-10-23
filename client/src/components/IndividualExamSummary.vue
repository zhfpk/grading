<script setup lang="ts">
import {useSettingsStore} from "@/individual-grading-store.js";
import {inject, onMounted, render} from "vue";
import {IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import IndividualExamSummaryExamineeData from "@/components/IndividualExamSummaryExamineeData.vue";
import {ExamTasksData} from "@/models/ExamTaskData";
import IndividualExamSummaryPoints from "@/components/IndividualExamSummaryPoints.vue";
import MessageContainer from "@/components/base/MessageContainer.vue";
import SettingsToggle from "@/components/base/SettingsToggle.vue";
import {LocalStorageSettings} from "@/models/Enums";
import ExamApi from "@/models/ExamApi";
import IndividualExamSummaryReassessment from "@/components/IndividualExamSummaryReassessment.vue";
import {ValidPublicSigningKeys} from "@/models/ExamineeGradingPoints";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";

interface Props {
  examineeSubmissions: IndividualExamineeSubmissions
  examTasksData: ExamTasksData
  examPhase: string
  validPublicKeys: ValidPublicSigningKeys
  examGradeCalculation: ExamGradeCalculation
  gradingMode: boolean
  previousExamineeIdentifier: string
  nextExamineeIdentifier: string
}

const examApi: ExamApi = inject<ExamApi>('examApi')

const settingsStore = useSettingsStore()

defineProps<Props>()

</script>

<template>
  <h3 class="mt-0">
    <template v-if="gradingMode">
      Grade {{examineeSubmissions.getAnonymizedName()}}
    </template>
    <template v-else>
      Review exam results of {{examineeSubmissions.getAnonymizedName()}}
    </template>
  </h3>

  <div class="flex-row">
    <section>
      <IndividualExamSummaryExamineeData :examinee-submissions="examineeSubmissions"></IndividualExamSummaryExamineeData>

      <MessageContainer v-if="examineeSubmissions.isNoShow()" type="info">
        This examinee did not show up to the exam.
      </MessageContainer>
      <MessageContainer v-else-if="examineeSubmissions.isNoGradingChosen()" type="warn">
        This examinee did choose not to grade the exam.
        Hence, the exam cannot be graded and will automatically fail with zero points.
      </MessageContainer>
      <template v-else>
        <IndividualExamSummaryPoints :exam-tasks-data="examTasksData" :exam-grade-calculation="examGradeCalculation"></IndividualExamSummaryPoints>

      </template>

      <IndividualExamSummaryReassessment v-if="!examineeSubmissions.isNoShow()"
                                         :exam-phase="examPhase"
                                         :examinee-identifier="examineeSubmissions.examineeIdentifier"
                                         :exam-tasks-data="examTasksData"
                                         :valid-public-keys="validPublicKeys"
                                         :examinee-submissions="examineeSubmissions"
                                         :exam-grade-calculation="examGradeCalculation"></IndividualExamSummaryReassessment>
    </section>
    <aside v-if="gradingMode" id="individual-grading-aside">
      <template v-if="previousExamineeIdentifier !== null || nextExamineeIdentifier !== null">
        <span v-if="previousExamineeIdentifier === null">&laquo; Previous</span>
        <a :href="examApi.buildIndividualGradingURL(previousExamineeIdentifier)" v-else>&laquo; Previous</a>
        &mdash;
        <span v-if="nextExamineeIdentifier === null">Next &raquo;</span>
        <a :href="examApi.buildIndividualGradingURL(nextExamineeIdentifier)" v-else>Next &raquo;</a>
      </template>

      <SettingsToggle description="Enable word wrap" v-model:activated="settingsStore.wordWrapEnabled" hot-key="l" :local-storage-entry="LocalStorageSettings.UI_SUBMISSION_WORD_WRAP"></SettingsToggle>
      <SettingsToggle description="Monospace font" v-model:activated="settingsStore.useMonospaceFont" :local-storage-entry="LocalStorageSettings.UI_SUBMISSION_MONOSPACE_FONT"></SettingsToggle>
      <SettingsToggle description="Whitespaces as ⌴" v-model:activated="settingsStore.visibleWhitespaces" hot-key="x" :local-storage-entry="LocalStorageSettings.UI_VISUALIZE_WHITESPACES"></SettingsToggle>
    </aside>
  </div>


</template>

<style scoped>
aside {
  padding-top: 0;
}
</style>