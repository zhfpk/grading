<script setup lang="ts">
import ExamApi, {getQueryParameters} from "@/models/ExamApi.js";
import {computed, onMounted, provide, ref} from "vue";
import {ExamSubtaskField, ExamTasksData} from "@/models/ExamTaskData";
import {PairedExamineeGradingSubmissions} from "@/models/PairedExamineeGradingSubmissions";
import GradingInputContainer from "@/components/GradingInputContainer.vue";
import SubmissionContainer from "@/components/SubmissionContainer.vue";
import GradingGroupInfoContainer from "@/components/GradingGroupInfoContainer.vue";
import SettingsToggle from "@/components/base/SettingsToggle.vue";
import {GradingType, LocalStorageSettings} from "@/models/Enums";
import MessageContainer from "@/components/base/MessageContainer.vue";
import LockedIcon from "@/components/base/LockedIcon.vue";
import BoxIcon from "@/components/base/BoxIcon.vue";
import LoadingIndicator from "@/components/base/LoadingIndicator.vue";
import ProgressBar from "@/components/base/ProgressBar.vue";
import HintContainer from "@/components/base/HintContainer.vue";

const examApi = new ExamApi()

const pairedExamineeGradingSubmissions = ref(null)
const examTasksData = ref<ExamTasksData>(null)

const examPhase = ref(null)
const selectedSubtaskFieldIdentifier = ref(null)
const selectedSubtaskFieldType = ref(null)
const submissionWordWrapEnabled = ref(window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_WORD_WRAP) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_WORD_WRAP) == 'true' : true)
const submissionVisualizeWhitespaces = ref(window.localStorage.getItem(LocalStorageSettings.UI_VISUALIZE_WHITESPACES) == 'true')
const submissionUseMonospaceFont = ref(window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_MONOSPACE_FONT) == 'true')
const groupingIgnoreCapitalization = ref(window.localStorage.getItem(LocalStorageSettings.GROUP_GRADING_IGNORE_CAPITALIZATION) == 'true')
const groupingTrimWhitespaces = ref(window.localStorage.getItem(LocalStorageSettings.GROUP_GRADING_TRIM_WHITESPACES) == 'true')
const submissionRegexFilter = ref("")
const sortBy = ref("frequency-desc")

const sortByOptions = [
    { text: "Frequency: most frequent first", value: "frequency-desc"},
    { text: "Frequency: least frequent first", value: "frequency-asc"},
    { text: "Achieved points: less points first", value: "points-asc"},
    { text: "Achieved points: more points first", value: "points-desc"},
    { text: "Submission length: short answers first", value: "length-asc"},
    { text: "Submission length: long answers first", value: "length-desc"}
]

onMounted(async () => {
  await examApi.initialize()

  examPhase.value = await examApi.getExamPhase()

  examTasksData.value = await examApi.getTasksData()

  const queryParameters = getQueryParameters()
  if (queryParameters.has('identifier')) {
    if (examTasksData.value.getSubtaskFieldNames().includes(queryParameters.get('identifier'))) {
      // this is a valid subtask identifier, select it
      selectedSubtaskFieldIdentifier.value = queryParameters.get('identifier')
    }
  }

  let examineeGradingPoints = await examApi.getGradingPoints()
  console.log("examineeGradingPoints", examineeGradingPoints)

  let examineeSubmissions = await examApi.getSubmissions()
  console.log("examineeSubmissions", examineeSubmissions)


  pairedExamineeGradingSubmissions.value = new PairedExamineeGradingSubmissions(examineeSubmissions, examineeGradingPoints)
  console.log("pairedExamineeGradingSubmissions", pairedExamineeGradingSubmissions)
});

const groupGradingEntries = computed(() => {
  if(!pairedExamineeGradingSubmissions.value) {
    return null
  }

  let m = pairedExamineeGradingSubmissions.value.getGroupGradingGroups(selectedSubtaskFieldIdentifier.value, groupingTrimWhitespaces.value, groupingIgnoreCapitalization.value)
  return m
})

const onSubtaskFieldIdentifierClick = (subtaskField: ExamSubtaskField) => {
  selectedSubtaskFieldIdentifier.value = subtaskField.identifier
  selectedSubtaskFieldType.value = subtaskField.fieldType
}

provide('examApi', examApi)

</script>

<template>
  <div class="">
<!--    <section>-->
    <p>
      With group grading you can grade all identical submissions (a submission group) for a subtask field at once.
      Select the subtask field that you want to grade from the list below.
    </p>
    <div v-if="examTasksData !== null" v-for="examTask in examTasksData.tasks">
      <div>
<!--        <strong>{{examTask.name}}</strong>-->
        <div v-for="subtask in examTask.subtasks" class="flex-row flex-col-gap-05" >
          <span>
            <strong>Subtask {{subtask.name}}</strong>
          </span>


          <span v-for="subtaskField in subtask.fields">
            &raquo;<a @click="onSubtaskFieldIdentifierClick(subtaskField)" class="plain-link" :class="{'active': subtaskField.identifier === selectedSubtaskFieldIdentifier}">{{subtaskField.identifier}}</a>
          </span>
<!--          <div v-for="subtaskField in subtask.fields">-->
<!--            &raquo;<a @click="onSubtaskFieldIdentifierClick(subtaskField)" class="inverted" :class="{'active': subtaskField === selectedSubtaskField}">a_very_long_description_of_a_tag</a>-->
<!--          </div>-->
        </div>
      </div>
    </div>
<!--    </section>-->

  </div>

  <div v-if="examPhase !== null && examPhase !== 'grading'" class="mt-1 mb-1">
    <MessageContainer type="warn">Due to the current exam phase, the gradings of submissions cannot be changed anymore.</MessageContainer>
  </div>

  <div v-if="groupGradingEntries !== null && selectedSubtaskFieldIdentifier !== null" class="mt-1">
    <h5 class="my-0"></h5>

    <details class="small-padding">
      <summary>Display, grouping and filtering options</summary>
      <div>
        <SettingsToggle description="Enable word wrap for submission content" hot-key="l" v-model:activated="submissionWordWrapEnabled" :local-storage-entry="LocalStorageSettings.UI_SUBMISSION_WORD_WRAP">
          Automatically adds line breaks to the submission elements so that no horizontal scrollbars are needed to read the content.
          <br /><br />
          <strong>Example (no word wrap)</strong> <br />
          <em>Lorem ipsum dolor sit amet.</em>
          <br /><br />
          <strong>Example (with word wrap)</strong> <br />
          <em>Lorem ipsum <br /> dolor sit amet.</em>
        </SettingsToggle>
        <SettingsToggle description="Use monospace font for submissions" v-model:activated="submissionUseMonospaceFont" :local-storage-entry="LocalStorageSettings.UI_SUBMISSION_MONOSPACE_FONT">
          Use monospace font when displaying the examinees' submissions. Might be helpful when reading source code.
          <br /><br />
          <strong>Example (without monospace font)</strong> <br />
          <em>Lorem ipsum dolor sit amet.</em>
          <br /><br />
          <strong>Example (with monospace font)</strong> <br />
          <em><span class="verb">Lorem ipsum dolor sit amet.</span></em>
        </SettingsToggle>
        <SettingsToggle description="Display whitespaces as ⌴" hot-key="x" v-model:activated="submissionVisualizeWhitespaces" :local-storage-entry="LocalStorageSettings.UI_VISUALIZE_WHITESPACES">
          Visualizes whitespaces in examinees' submissions as ⌴ characters. Might be useful when the presence of a whitespace may be relevant for a correct solution.
          <br /><br />
          <strong>Example (normal whitespaces)</strong> <br />
          <em>Lorem ipsum dolor sit amet.</em>
          <br /><br />
          <strong>Example (visualized whitespaces)</strong> <br />
          <em>Lorem⌴ipsum⌴dolor⌴sit⌴amet.</em>
        </SettingsToggle>
        <SettingsToggle description="Ignore (trim) trailing and leading whitespaces in submissions when building groups" v-model:activated="groupingTrimWhitespaces" :local-storage-entry="LocalStorageSettings.GROUP_GRADING_TRIM_WHITESPACES">
          When enabled, all whitespaces at the beginning and the end of submissions will be ignored.
          Therefore, the submissions "<em>example</em>", "<em>⌴example⌴</em>", "<em>⌴example</em>", etc. will be put into the same submission group "<em>example</em>".
        </SettingsToggle>
        <SettingsToggle description="Ignore capitalization in submissions when building groups" v-model:activated="groupingIgnoreCapitalization" :local-storage-entry="LocalStorageSettings.GROUP_GRADING_IGNORE_CAPITALIZATION">
          When enabled, capitalization in submissions will be ignored.
          Therefore, the submissions "<em>Example</em>", "<em>examPle</em>", "<em>EXAMple</em>", etc. will be put into the same submission group "<em>example</em>".
        </SettingsToggle>

        <select v-model="sortBy">
          <option v-for="option in sortByOptions" :value="option.value">
            {{ option.text }}
          </option>
        </select> <br/>

        <input type="text" placeholder="Enter an expression to filter the displayed submissions..." v-model="submissionRegexFilter" size="40">
      </div>
    </details>

    <h4 id="submissionGroupHeading" class="mb-0 mt-2">Submission groups ({{groupGradingEntries.getGroupCount()}} groups with {{groupGradingEntries.numTotalSubmissions}} submissions)</h4>
    <div class="flex-row flex-col-gap-1 flex-align-items-baseline" v-if="groupGradingEntries.numLockedSubmissions > 0 || groupGradingEntries.numLockedGradings">
      <div>Excluded submissions during grouping:</div>
      <div v-if="groupGradingEntries.numLockedSubmissions > 0">
        <LockedIcon title=""/> Submissions: {{groupGradingEntries.numLockedSubmissions}}
        <HintContainer>
          You do not have permission to access all submissions for the selected subtask field. Hence, some locked submissions were excluded when building the groups.
        </HintContainer>
      </div>
      <div v-if="groupGradingEntries.numLockedGradings > 0">
        <LockedIcon title=""/> Gradings: {{groupGradingEntries.numLockedGradings}}
        <HintContainer>
          You do not have permission to access all gradings for the selected subtask field. Hence, some submissions and their locked gradings were excluded when building the groups.
        </HintContainer>
      </div>
    </div>

    <div class="flex-row mb-2 mt-05">
      <section>
        <ProgressBar :value="Math.round(groupGradingEntries.getGradingDoneCount() / groupGradingEntries.getGroupCount() * 100)" label="graded"></ProgressBar>
      </section>
      <aside></aside>
    </div>

    <MessageContainer type="" class="mb-15" v-if="selectedSubtaskFieldType === 'paper'">
      <i class="ri-article-line"></i> <em>This is a paper-based field, hence, there are no electronic submissions available.</em>
    </MessageContainer>

    <div v-for="(groupGradingEntry, index) in groupGradingEntries.getSortedGroups(sortBy)">
      <div class="flex-row" v-if="groupGradingEntry.matchesFilter(submissionRegexFilter)">
        <section>
          <SubmissionContainer
              :submission-value="groupGradingEntry.submittedValue"
              :word-wrap-enabled="submissionWordWrapEnabled"
              :visualize-whitespaces="submissionVisualizeWhitespaces"
              :use-monospace-font="submissionUseMonospaceFont">
          </SubmissionContainer>

          <GradingInputContainer
              :key="selectedSubtaskFieldIdentifier + '___' + index"
              :field-identifier="selectedSubtaskFieldIdentifier"
              :exam-phase="examPhase"
              :grading-type="GradingType.GROUP_GRADING"
              :examinee-grading-points="groupGradingEntry.examineeGradingPoints"
              :suggestions="groupGradingEntries.getGradingInputStrings()">
          </GradingInputContainer>

        </section>
        <aside>
          <GradingGroupInfoContainer :examinee-grading-points="groupGradingEntry.examineeGradingPoints" :total-submission-count="groupGradingEntries.getShownSubmissionCount()"></GradingGroupInfoContainer>
        </aside>
      </div>
    </div>
  </div>
  <LoadingIndicator v-if="groupGradingEntries === null && selectedSubtaskFieldIdentifier !== null"/>

</template>

<style scoped>
a.active {
  color: var(--text);
  font-weight: bold;
}
</style>