<script setup lang="ts">
import ExamApi from "@/models/ExamApi";
import {computed, onMounted, ref, watch} from "vue";
import {IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import {
  ExamGradingProgress,
  ExamineeGradingPoints,
  IndividualExamineeGradingPoints,
  PostExamReviewData,
  ReassessmentResult,
  SummarizedExamPoints
} from "@/models/ExamineeGradingPoints";
import SettingsToggle from "@/components/base/SettingsToggle.vue";
import {LocalStorageSettings} from "@/models/Enums";
import OverviewExamineeTableRow from "@/components/OverviewExamineeTableRow.vue";
import LockedIcon from "@/components/base/LockedIcon.vue";
import {ExamTasksData} from "@/models/ExamTaskData";
import {PairedExamineeGradingSubmissions} from "@/models/PairedExamineeGradingSubmissions";
import MessageContainer from "@/components/base/MessageContainer.vue";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import LoadingIndicator from "@/components/base/LoadingIndicator.vue";

const examineeDataReady = ref<Boolean>(false)
const areSomePointsLocked = ref<Boolean>(false)
const individualExamineeSubmissions = ref([])
let examineeGradingPoints: ExamineeGradingPoints = null
let examTasksData: ExamTasksData = null
let gradeCalculation: ExamGradeCalculation = null
let examineeGradingPointsHashes: Map<string, string> = null
const currentExamPhase = ref(null)
const sortBy = ref("name")
const sortOrder = ref(1)
const filterName = ref("")
const showNoShows = ref(window.localStorage.getItem(LocalStorageSettings.UI_OVERVIEW_SHOW_NO_SHOWS) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_OVERVIEW_SHOW_NO_SHOWS) == 'true' : false)
const showRealNames = ref(window.localStorage.getItem(LocalStorageSettings.UI_OVERVIEW_REAL_NAMES) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_OVERVIEW_REAL_NAMES) == 'true' : false)

const examApi = new ExamApi()

const sortedAndFilteredExaminees = computed(() => {
  let data: Array<IndividualExamineeSubmissions> = individualExamineeSubmissions.value

  if (data.length === 0) {
    return []
  }

  if (showNoShows.value === false) {
    data = data.filter((examineeSubmissions) => !examineeSubmissions.isNoShow())
  }

  if (filterName.value !== null && filterName.value.length > 0) {
    data = data.filter((examineeSubmissions) => {
      if (showRealNames.value === false) {
        // use anonymized data to filter the name
        return examineeSubmissions.getAnonymizedName().toLowerCase().indexOf(filterName.value.toLowerCase()) > -1
      } else {
        // use personal data to filter
        let realName = examineeSubmissions.getRealName(true)
        return realName === null || realName.toLowerCase().indexOf(filterName.value.toLowerCase()) > -1
      }
    })
  }

  data = data.sort((a, b) => {
    if (sortBy.value === 'name') {
      if (showRealNames.value === false) {
        a = a.getAnonymizedName()
        b = b.getAnonymizedName()
      } else {
        // note: use the anonymized name in case that the real name (personal data) is not available
        a = a.isPersonalDataLocked() ? a.getAnonymizedName() : a.getRealName(true)
        b = b.isPersonalDataLocked() ? b.getAnonymizedName() : b.getRealName(true)
      }
      return (a === b ? 0 : a > b ? 1 : -1) * sortOrder.value
    } else if (sortBy.value === 'achieved-points' || sortBy.value === 'possible-points') {
      let pointsA = 0
      let pointsB = 0

      if (a.isNoShow()) {
        pointsA = -2
      } else if (a.isNoGradingChosen()) {
        pointsA = -1
      } else {
        let gradingA = examineeGradingPoints.getGradingsOf(a.examineeIdentifier)
        let examPointsA: SummarizedExamPoints = gradingA.getSummarizedExamPoints(examTasksData, gradeCalculation)
        pointsA = sortBy.value === 'achieved-points' ? examPointsA.achievedPoints : examPointsA.possiblePoints
      }

      if (b.isNoShow()) {
        pointsB = -2
      } else if (b.isNoGradingChosen()) {
        pointsB = -1
      } else {
        let gradingB = examineeGradingPoints.getGradingsOf(b.examineeIdentifier)
        let examPointsB: SummarizedExamPoints = gradingB.getSummarizedExamPoints(examTasksData, gradeCalculation)
        pointsB = sortBy.value === 'achieved-points' ? examPointsB.achievedPoints : examPointsB.possiblePoints
      }

      return (pointsA === pointsB ? 0 : pointsA > pointsB ? 1 : -1) * sortOrder.value
    } else if (sortBy.value === 'grading-status') {
      let gradingA = examineeGradingPoints.getGradingsOf(a.examineeIdentifier)
      let examPointsA: SummarizedExamPoints = gradingA.getSummarizedExamPoints(examTasksData, gradeCalculation)
      let gradingB = examineeGradingPoints.getGradingsOf(b.examineeIdentifier)
      let examPointsB: SummarizedExamPoints = gradingB.getSummarizedExamPoints(examTasksData, gradeCalculation)

      let valueA = examPointsA.inconsistentGradings ? 1 : examPointsA.allGradingsDone ? -1 : 0
      let valueB = examPointsB.inconsistentGradings ? 1 : examPointsB.allGradingsDone ? -1 : 0
      return (valueA === valueB ? 0 : valueA > valueB ? 1 : -1) * sortOrder.value
    } else if (sortBy.value === 'reassessment-status') {
      let gradingA = examineeGradingPoints.getGradingsOf(a.examineeIdentifier)
      let examPointsA: SummarizedExamPoints = gradingA.getSummarizedExamPoints(examTasksData, gradeCalculation)
      let reassessmentA: ReassessmentResult = gradingA.getReassessmentResult()
      let isReassessmentValidA: boolean = reassessmentA.isApprovedAndValid(examineeGradingPoints.validPublicKeys, examineeGradingPointsHashes.get(a.examineeIdentifier), a.answerFilesHashHex)

      let gradingB = examineeGradingPoints.getGradingsOf(b.examineeIdentifier)
      let examPointsB: SummarizedExamPoints = gradingB.getSummarizedExamPoints(examTasksData, gradeCalculation)
      let reassessmentB: ReassessmentResult = gradingB.getReassessmentResult()
      let isReassessmentValidB: boolean = reassessmentB.isApprovedAndValid(examineeGradingPoints.validPublicKeys, examineeGradingPointsHashes.get(b.examineeIdentifier), b.answerFilesHashHex)

      let valueA = (examPointsA.alreadyPassed || a.isNoShow()) ? 1 : isReassessmentValidA ? -1 : 0
      let valueB = (examPointsB.alreadyPassed || b.isNoShow()) ? 1 : isReassessmentValidB ? -1 : 0
      return (valueA === valueB ? 0 : valueA > valueB ? 1 : -1) * sortOrder.value
    } else if (sortBy.value === 'post-exam-review-status') {
      let gradingA = examineeGradingPoints.getGradingsOf(a.examineeIdentifier)
      let postExamReviewDataA: PostExamReviewData = gradingA.getPostExamReviewData()

      let gradingB = examineeGradingPoints.getGradingsOf(b.examineeIdentifier)
      let postExamReviewDataB: PostExamReviewData = gradingB.getPostExamReviewData()

      let valueA = (a.isNoShow()) ? 1 : postExamReviewDataA.isReviewAccessed() ? -1 : 0
      let valueB = (b.isNoShow()) ? 1 : postExamReviewDataB.isReviewAccessed() ? -1 : 0
      return (valueA === valueB ? 0 : valueA > valueB ? 1 : -1) * sortOrder.value
    }
  })

  console.log("data is", data)
  return data
})

function setSortBy(key) {
  sortBy.value = key
  sortOrder.value *= -1
}

const tableColumnsHeaders = computed(() => {
  let columns = [
    ["name", "Anonymized name"],
    ["achieved-points", "Achieved Points"]
  ]
  if (currentExamPhase.value === 'grading') {
    columns.push(["possible-points", "Possible Points"])
  }
  columns.push(["grading-status", "Grading Status"])

  if (showRealNames.value === true) {
    columns[0] = ["name", "Real name"]
  }
  if (currentExamPhase.value !== 'grading') {
    columns.push(['reassessment-status', 'Reassessment Status'])
  }
  if (currentExamPhase.value === 'review') {
    columns.push(['post-exam-review-status', 'Post-Exam Review Status'])
  }
  return columns
})

function calcPercentage(count: number, total: number) {
  if (total > 0)
    return count.toString() + "/" + total.toString() + " (" + Math.round(count / total * 100).toString() + "%)"
  else
    return "-"
}

const percentageNoShows = computed(() => {
  return calcPercentage(sortedAndFilteredExaminees.value.filter(e => e.isNoShow()).length, sortedAndFilteredExaminees.value.length)
})

const percentageGradingsDone = computed(() => {
  return calcPercentage(sortedAndFilteredExaminees.value.filter(e => examineeGradingPoints.getGradingsOf(e.examineeIdentifier).getSummarizedExamPoints(examTasksData, gradeCalculation).allGradingsDone).length, sortedAndFilteredExaminees.value.length)
})

const percentageAlreadyPassed = computed(() => {
  return calcPercentage(sortedAndFilteredExaminees.value.filter(e => examineeGradingPoints.getGradingsOf(e.examineeIdentifier).getSummarizedExamPoints(examTasksData, gradeCalculation).alreadyPassed).length, sortedAndFilteredExaminees.value.length)
})

const percentagePossiblyPasses = computed(() => {
  return calcPercentage(sortedAndFilteredExaminees.value.filter(e => examineeGradingPoints.getGradingsOf(e.examineeIdentifier).getSummarizedExamPoints(examTasksData, gradeCalculation).possiblyPasses).length, sortedAndFilteredExaminees.value.length)
})

const percentageReviewed = computed(() => {
  return calcPercentage(sortedAndFilteredExaminees.value.filter(e => examineeGradingPoints.getGradingsOf(e.examineeIdentifier).getPostExamReviewData().isReviewAccessed()).length,
      sortedAndFilteredExaminees.value.filter(e => !e.isNoShow()).length)
})

const percentageReassessed = computed(() => {
  let countReassessmentPending = 0
  let countReassessmentRelevant = 0

  for (let examineeSubmissions of sortedAndFilteredExaminees.value) {
    if (examTasksData === null || gradeCalculation === null) {
      return "-"
    }
    if (examineeSubmissions.isNoShow()) {
      continue
    }
    let grading = examineeGradingPoints.getGradingsOf(examineeSubmissions.examineeIdentifier)
    if (grading.getSummarizedExamPoints(examTasksData, gradeCalculation).alreadyPassed) {
      continue
    }
    if (!grading.getReassessmentResult().isLocked()) {
      if(grading.getReassessmentResult().isApprovedAndValid(examineeGradingPoints.validPublicKeys, examineeGradingPointsHashes.get(examineeSubmissions.examineeIdentifier), examineeSubmissions.answerFilesHashHex)) {
        countReassessmentPending++;
      }
      countReassessmentRelevant++;
    }
  }

  return calcPercentage(countReassessmentPending, countReassessmentRelevant)
})

onMounted(async () => {
  await examApi.initialize()

  currentExamPhase.value = await examApi.getExamPhase()
  examTasksData = await examApi.getTasksData()
  gradeCalculation = await examApi.getExamGradeCalculation()

  const examineeGradingPointsPromise = examApi.getGradingPoints()



  const examineeSubmissionsPromise = examApi.getSubmissions()

  // must be fetched first
  examineeGradingPoints = await examineeGradingPointsPromise
  console.log("examineeGradingPoints", examineeGradingPoints)

  examineeGradingPointsHashes = new Map<string, string>()
  for (let individualExamineeGradingPoints of examineeGradingPoints.examineeGradingPointsMap.values()) {
    if (!areSomePointsLocked.value) {
      // check as long there have not been any locked points
      areSomePointsLocked.value = individualExamineeGradingPoints.hasAnyLockedPoints()
    }
    examineeGradingPointsHashes.set(individualExamineeGradingPoints.examineeIdentifier, await individualExamineeGradingPoints.calculateHashOverGradings(examApi.examName))
  }


  const examineeSubmissions = await examineeSubmissionsPromise
  const submissions = [...(examineeSubmissions).getIndividualExamineeSubmissions()]

  individualExamineeSubmissions.value = submissions

  examineeDataReady.value = true
});

</script>

<template>
  <LoadingIndicator v-if="currentExamPhase === null"/>
  <MessageContainer v-else type="info">
    Currently, the exam is in
    <template v-if="currentExamPhase === 'grading'">
      the <strong>grading</strong> phase. This means, you may grade the examinee's submissions.
    </template>
    <template v-else-if="currentExamPhase === 'reassessment'">
      the <strong>reassessment</strong> phase. Therefore, gradings can no longer be changed.
    </template>
    <template v-else-if="currentExamPhase === 'review'">
      the <strong>review</strong> phase. Therefore, gradings cannot be changed anymore. Examinees may inspect their exam results.
    </template>
    <template v-else>
      an unsupported phase. Something seems to be broken.
    </template>
  </MessageContainer>

  <h4 class="mb-05 mt-2">List of examinees</h4>

  <div>
    <SettingsToggle description="Include examinees that did not participate in the exam (no-shows)." v-model:activated="showNoShows" :local-storage-entry="LocalStorageSettings.UI_OVERVIEW_HIDE_NO_SHOWS"></SettingsToggle>
    <SettingsToggle description="Show examinee's actual names instead of pseudonyms (disable anonymous grading)." v-model:activated="showRealNames" :local-storage-entry="LocalStorageSettings.UI_OVERVIEW_REAL_NAMES"></SettingsToggle>

    <input v-model="filterName" id="nameFilter" type="text" placeholder="Search examinees by name">
    <br />
  </div>

  <LoadingIndicator v-if="!examineeDataReady"/>
  <template v-else>
    <div class="mt-1">
      {{ sortedAndFilteredExaminees.length }}
      <span v-if="sortedAndFilteredExaminees.length !== individualExamineeSubmissions.length">
        / {{ individualExamineeSubmissions.length }}
      </span>
      registered
      <template v-if="sortedAndFilteredExaminees.length === 1">examinee</template>
      <template v-else>examinees</template>
    </div>
    <table v-if="sortedAndFilteredExaminees.length > 0" class="mt-05">
      <thead>
        <tr>
          <th v-for="[colid, coltext] in tableColumnsHeaders" @click="setSortBy(colid)" class="sortable no-border-b pb-0">
            <span :class="{'active': sortBy === colid}">{{coltext}}</span>
            <i v-if="sortBy !== colid" class="ri-expand-up-down-line inactive"></i>
            <i v-else-if="sortBy === colid && sortOrder === -1" class="ri-arrow-up-s-fill"></i>
            <i v-else-if="sortBy === colid && sortOrder === 1" class="ri-arrow-down-s-fill"></i>
          </th>
        </tr>
        <tr>
          <td class="no-border-t px-0 py-0"></td>
          <td class="pt-0 no-border-t fs-75 valign-t">
            {{percentageAlreadyPassed}} pass
            <template v-if="showNoShows">
              <br />
              incl. {{percentageNoShows}} no-shows
            </template>
          </td>
          <td class="pt-0 no-border-t fs-75 valign-t" v-if="currentExamPhase === 'grading'">
            {{percentagePossiblyPasses}} may pass
          </td>
          <td class="pt-0 no-border-t fs-75 valign-t">
            {{percentageGradingsDone}} graded
          </td>
          <td class="pt-0 no-border-t fs-75 valign-t" v-if="currentExamPhase !== 'grading'">
            {{percentageReassessed}} reassessed
          </td>
          <td class="pt-0 no-border-t fs-75 valign-t" v-if="currentExamPhase === 'review'">
            {{percentageReviewed}} reviewed
          </td>
        </tr>
      </thead>
      <tbody>
        <template v-for="examineeSubmissions in sortedAndFilteredExaminees">
          <OverviewExamineeTableRow v-if="examineeGradingPoints.hasGradingPointsOf(examineeSubmissions.examineeIdentifier)"
              :examinee-submissions="examineeSubmissions"
              :summarized-exam-points="examineeGradingPoints.getGradingsOf(examineeSubmissions.examineeIdentifier).getSummarizedExamPoints(examTasksData, gradeCalculation)"
              :show-real-names="showRealNames"
              :exam-phase="currentExamPhase"
              :reassessment-valid="examineeGradingPoints.getGradingsOf(examineeSubmissions.examineeIdentifier).getReassessmentResult().isLocked() ? null : examineeGradingPoints.getGradingsOf(examineeSubmissions.examineeIdentifier).getReassessmentResult().isApprovedAndValid(examineeGradingPoints.validPublicKeys, examineeGradingPointsHashes.get(examineeSubmissions.examineeIdentifier), examineeSubmissions.answerFilesHashHex)"
              :has-grading-annotations="examineeGradingPoints.getGradingsOf(examineeSubmissions.examineeIdentifier).hasInternalGradingAnnotations()"
              :post-exam-review-data="examineeGradingPoints.getGradingsOf(examineeSubmissions.examineeIdentifier).getPostExamReviewData()"
              :exam-api="examApi">
          </OverviewExamineeTableRow>
          <tr v-else><td colspan="4"><LockedIcon /> Insufficient permission</td></tr>
        </template>
      </tbody>
    </table>

    <small v-if="areSomePointsLocked">[1] Some of the examinee's gradings cannot be accessed due to insufficient permissions. Therefore, only the accessible points are summed up. Actual points may differ.</small>
  </template>

</template>

<style scoped>
th {
  text-decoration: none;
}

th.sortable {
  cursor: pointer;
}

th.sortable.active {
  text-decoration: underline;
}

i.inactive {
  opacity: 75%;
}

</style>
