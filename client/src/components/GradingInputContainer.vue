<script setup lang="ts">

import {computed, inject, ref, toRefs, watch} from "vue";
import {GradingInput, GradingPoints} from "@/models/ExamineeGradingPoints";
import ExamApi from "@/models/ExamApi";
import {GradingType} from "@/models/Enums";
import {AppError} from "@/models/AppError";
import SuggestionContainer from "@/components/SuggestionContainer.vue";

interface Props {
  fieldIdentifier: string
  examineeGradingPoints: Array<GradingPoints>
  examPhase: string
  gradingType: GradingType
  suggestions?: string[]
}

const props = defineProps<Props>()

const {fieldIdentifier, examineeGradingPoints, examPhase, gradingType, suggestions = []} = toRefs(props)


const examApi: ExamApi = inject('examApi')

const suggestionContainer = ref(null)
const isInputFocused = ref<boolean>(false)
const savedSuccessfully = ref(false)
const savingErrorMessage = ref("")
const inputElement = ref(null)

const closeDetails = props.examineeGradingPoints[0].isDone()

const gradingInputString = defineModel()
// note: this watch is mandatory to make sure the grading string changes when changing between subtask fields
watch(
  () => props.examineeGradingPoints,
  (newVal) => {
    gradingInputString.value = newVal[0].toInputValue()
    savedSuccessfully.value = false
  },
  {immediate: true}
)
const gradingSummary = computed(() => {
  // savedSuccessfully.value = false

  if (gradingInputString.value.length === 0) {
    return "Enter your grading below"
  }
  try {
    return GradingInput.parse(gradingInputString.value).toSummary()
  } catch (e) {
    if (e instanceof AppError) {
      return "Error: " + e.message
    } else {
      return "Error: Internal parsing issue"
    }
  }
})

const modifiable = computed(() => {
  if (props.examPhase !== 'grading') {
    return false
  }

  for (let examineeGradingPoints of props.examineeGradingPoints) {
    if (!examApi.userHasPermission('upload-grading-points:' + examineeGradingPoints.examineeIdentifier + ":" + examineeGradingPoints.mappedFileName)) {
      return false
    }
  }
  return true
})

const gradingComplete = computed(() => {
  try {
    let tmpGradingInput = GradingInput.parse(gradingInputString.value)
    return tmpGradingInput.points !== null
  } catch (e) {
    return false
  }
})

async function triggerSaving(event) {
  console.log("triggerSaving is called")
  savedSuccessfully.value = false

  let input = gradingInputString.value

  if (!GradingInput.isValid(input)) {
    savingErrorMessage.value = "Error: No changes made! Invalid grading provided. Please use the specified format."
    return
  }

  const gradingInput = GradingInput.parse(input)
  try {
    // we are trying to update here to check whether when reclicking on the same subtask field, we still have the "new" grading

    let gradingPointsToSave = []
    for(let gradingPoints of props.examineeGradingPoints) {
      gradingPoints.update(gradingInput, props.gradingType)
      gradingPointsToSave.push(gradingPoints)
    }
    const responseObj = await examApi.saveGradingPoints(...gradingPointsToSave)
    if (responseObj.status === 201) {
      savingErrorMessage.value = ""
      savedSuccessfully.value = true
    } else if (responseObj.status === 207) {

      if (Object.prototype.hasOwnProperty.call(responseObj, "content") && responseObj.content !== null && typeof responseObj.content === 'object' && Object.prototype.hasOwnProperty.call(responseObj.content, "successful")) {
        const successfulSaves = responseObj.content.successful
        savingErrorMessage.value = "Partial success: The following grading were saved successfully: " + successfulSaves.toString() + "."
      } else {
        savingErrorMessage.value = "Error: Server returned partial success without further details."
      }
    } else {
      savingErrorMessage.value = "Error: An unexpected error occurred."
    }

  } catch(error) {
    if (error instanceof AppError) {
      savingErrorMessage.value = "Error: " + error.message
    } else {
      console.error(error)
      savingErrorMessage.value = "Error: Local exception occurred! Reload the page, and if the issue persists, contact the service providers."
    }
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (suggestionContainer.value !== null) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      suggestionContainer.value.onArrowDown()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      suggestionContainer.value.onArrowUp()
    } else if (event.key === 'Enter') {
      suggestionContainer.value.onEnter()
    } else if (event.key === 'Escape') {
      suggestionContainer.value.onEscape()
    }
  }
}

function onSelected(content: string) {
  console.log("onSelected called:", content)
  gradingInputString.value = content
  console.log("changing value caused value of input to be: ", inputElement.value.value)
  inputElement.value.dispatchEvent(new Event('change', { bubbles: true }))
}

</script>

<template>

  <div class="flex-row flex-align-items-baseline flex-col-gap-05 grading-box-container">
    <div class="flex-grow-1">
      <div v-if="!modifiable" class="grading-box" :class="{'grading-complete': gradingComplete}">
        <template v-if="gradingComplete">
          {{ gradingSummary }}
        </template>
        <template v-else>
          <em>No grading available</em>
        </template>
      </div>

      <details v-else class="grading-box" :class="{'grading-complete': gradingComplete}" :id="fieldIdentifier + '_box'" :open="!closeDetails" >
        <summary tabindex="-1">{{ gradingSummary }}</summary>
        <div class="flex-row flex-col-gap-05 flex-align-items-baseline">
          <div class="position-relative flex-grow-1">
            <input
             type="text"
             class="grading-field"
             ref="inputElement"
             :class="{'save-error': savingErrorMessage.length > 0, 'save-success': savedSuccessfully}"
             placeholder="<points> <optional comment> # <optional internal annotation>"
             v-model="gradingInputString"
             @change="event => triggerSaving(event)"
             @focus="isInputFocused=true"
             @blur="isInputFocused=false"
             @keydown="event => handleKeyDown(event)"
            />
            <SuggestionContainer v-if="suggestions !== null && isInputFocused" ref="suggestionContainer" :current-input="gradingInputString" :suggestions="suggestions" @selected="s => onSelected(s)"></SuggestionContainer>
            <br />
            <small class="error">{{ savingErrorMessage }}</small>
          </div>
          <div>
            <i class="ri-check-double-line success" v-if="savedSuccessfully" title="Saved successfully"></i>
            <i class="ri-error-warning-line error" v-else-if="savingErrorMessage.length > 0" title="Saving failed"></i>
          </div>
        </div>

      </details>

      <div v-if="gradingType === GradingType.INDIVIDUAL_GRADING" class="subtask-field-identifier-box smaller">
        Field name: <span class="verb"><a tabindex="-1" class="inverted" :href="examApi.buildGroupGradingURL(fieldIdentifier)">{{ fieldIdentifier }}</a></span>
      </div>
    </div>

    <div class="smaller grading-type-container">
      <div v-if="gradingType === GradingType.INDIVIDUAL_GRADING && examineeGradingPoints.length === 1 && !examineeGradingPoints[0].isGradingTypeLocked() && examineeGradingPoints[0].gradingType !== null">
        <i v-if="examineeGradingPoints[0].gradingType === GradingType.AUTOMATIC_GRADING" class="ri-robot-3-line" title="Automatically graded by our e-exam tool"></i>
        <i v-else-if="examineeGradingPoints[0].gradingType === GradingType.GROUP_GRADING" class="ri-group-3-fill" title="Graded using group grading"></i>
        <i v-else-if="examineeGradingPoints[0].gradingType === GradingType.INDIVIDUAL_GRADING" class="ri-user-fill" title="Graded using individual grading"></i>
        <i v-else-if="examineeGradingPoints[0].gradingType === GradingType.IMPORTED_GRADING" class="ri-arrow-down-circle-line" title="Grading imported"></i>
      </div>
    </div>
  </div>

</template>

<style scoped>

.grading-field {
  width: 100%;
}

</style>