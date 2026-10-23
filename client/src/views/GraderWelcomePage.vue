<script setup>
import ExamApi from "@/models/ExamApi";
import {onMounted, ref} from "vue";
import {AppError} from "@/models/AppError";
import {LocalCredentialsStore} from "@/models/LocalCredentialsStore";
import ClipboardButton from "@/components/base/ClipboardButton.vue";
import LoadingIndicator from "@/components/base/LoadingIndicator.vue";
import {ExamTasksData} from "@/models/ExamTaskData";
import NaClCrypto from "@/models/NaClCrypto";
import MessageBox from "@/components/base/MessageBox.vue";
import {RecoveryFile} from "@/models/Exporting";
import MessageContainer from "@/components/base/MessageContainer.vue";

let examApi;

const errorMessage = ref(null)
const uiState = ref(null)
const userAlreadyExists = ref(false)
const currentURL = ref(null)
const examTasksData = ref(null)
const graderPseudonym = ref(null)
const graderName = ref(null)
const downloadIsLoading = ref(false)
const recoveryFileWasDownloaded = ref(false)
const recoveryFileIsValid = ref(false)

// take from the fragment ONLY
const urlFragment = document.location.hash
if (NaClCrypto.isValidKeyString(urlFragment, true)) {
  examApi = new ExamApi(true)
} else {
  examApi = new ExamApi(false)
}

let generatedKeyPair = null

onMounted(async () => {
  await examApi.initialize()
  if (examApi.userData.hasPublicSigningKey()) {
    const signingKeysMatch = await examApi.verifyPrivateKeyAndDownloadedPublicKeyMatch()
    if (!signingKeysMatch)
      throw new AppError("This invitation link was already used by someone. If this wasn't you, there is a potential security breach. Contact the person that gave you this link.")
    userAlreadyExists.value = true
  } else {
    generatedKeyPair = await examApi.generateSigningKeys()
  }
  currentURL.value = document.location

  examTasksData.value = await examApi.getTasksData()

  graderPseudonym.value = examApi.userData.pseudonym
  graderName.value = examApi.userData.realName
  uiState.value = 0
});

let continueButtonEnabled = ref(false)

const clickOnDownloadRecoveryFile = async () => {
  downloadIsLoading.value = true

  try {
    const recoveryFile = examApi.getRecoveryFile()
    recoveryFile.download()
    recoveryFileWasDownloaded.value = true
  } catch (e) {
    if (e instanceof AppError) {
      errorMessage.value = e.message
    } else {
      console.error(e)
      errorMessage.value = "An unhandled error occurred while downloading the recovery file. Please try again later."
    }
  }
  downloadIsLoading.value = false
}

const onRecoveryFileChanged = async (event) => {
  recoveryFileIsValid.value = false
  errorMessage.value = null

  const fileList = event.target.files
  if (fileList.length === 0) {
    errorMessage.value = "No file selected"
    return
  } else if (fileList.length > 1) {
    errorMessage.value = "Cannot provide more than one file"
    return
  }

  const file = fileList[0]
  if (file.size <= 0) {
    errorMessage.value = "Please select a valid recovery file"
    return
  }

  try {
    const uploadedRecoveryFile = await RecoveryFile.fromUploadedFile(file)

    if (examApi.getRecoveryFile().matches(uploadedRecoveryFile)) {
      recoveryFileIsValid.value = true
    } else {
      throw new AppError("The selected recovery file does not match the current exam. Did you select the correct file?")
    }
  } catch(e) {
    if (e instanceof AppError) {
      errorMessage.value = e.message
    } else {
      console.error(e)
      errorMessage.value = "An unhandled error occurred while accepting the invitation. Please try again later."
    }
  }
}

function stepUi(change) {
  uiState.value = uiState.value + change
  recoveryFileWasDownloaded.value = false
  errorMessage.value = null
  recoveryFileIsValid.value = false
}

async function startGrading() {
  // here: the server may already contain a public key; those keys must match (see check in onMounted)

  if (!examApi.userData.hasPublicSigningKey()) {
    // if the server does not know a public key yet, take the generated key from onMounted and upload it

    if (generatedKeyPair === null) {
      throw new AppError("There was an error while loading the page. Please reload the page.")
    }

    const publicKey = generatedKeyPair.publicKey

    try {
      await examApi.uploadPublicSigningKey(publicKey)
    } catch (error) {
      throw error
    }
  }

  // when the start grading was pressed, always add the current credentials from the URL to the local store
  const localCredentialsStore = new LocalCredentialsStore()
  localCredentialsStore.addCredential({
    uuid: examApi.uuid,
    keys: examApi.crypto.buildKeyFragment(false),
    examName: examApi.examName,
    graderPseudonym: graderPseudonym.value !== null ? graderPseudonym.value : null
  })

  // when there is no error, just redirect
  examApi.redirectTo("/grading/overview")
}

</script>

<template>
  <h3 class="mt-2 mb-1">
    Welcome<template v-if="userAlreadyExists === true"> back</template>, {{ graderName }}!
  </h3>
  <p class="mb-0">
    You’ve been invited to grade the exam
  </p>

  <p class="mt-1 ml-2">
    <template v-if="examTasksData !== null && examTasksData.examName !== null">
      <strong>{{ examTasksData.examName }}</strong> (internal name: <em>{{examApi.examName}}</em>).
    </template>
    <em v-else>{{ examApi.examName }}.</em>
  </p>

  <p >
    <template v-if="examTasksData !== null && examTasksData.examDate">
      The exam took place on the <strong>{{examTasksData.examDate}}</strong>.
    </template>
    <template v-if="graderPseudonym !== null">
      Your pseudonym for grading this exam is <strong>{{graderPseudonym}}</strong>. Other users will see this pseudonym instead of your real name (check out our <a href="/privacy">privacy policy</a> for more details).
    </template>
  </p>

  <div v-if="userAlreadyExists">

    <p>
      You have already accepted the invitation in a previous session.
      Your personal access link for grading is shown below.
      You can also download your recovery file again by clicking <a @click="clickOnDownloadRecoveryFile" class="clickable">here</a>.
    </p>

    <p v-if="currentURL !== null" class="fs-95 wrap-anywhere mt-s">
      <span class="verb">{{ currentURL.toString() }}</span>
      <ClipboardButton :text="currentURL.toString()" class="ml-05" hint="Click to copy link"></ClipboardButton>
    </p>
    <LoadingIndicator v-else />

    <p>
      <strong>Important warning: Don’t share this link or the recovery file with anyone.</strong><br>
      The link and the recovery file contains your personal access credentials.
      If someone else uses your link, they can impersonate you and grade under your name.
      If another grader needs access to the exam, invite them by creating a separate grader account and sending them their own invitation link.
    </p>

    <button @click="startGrading">Continue grading</button>
  </div>
  <template v-else>
    <MessageBox v-if="uiState === 0">
      <template #heading>Step 1/3) Save this link</template>
      <template #content>
        <p>
          Please <strong>save the link to this page</strong> (shown below).
          This is your personal access link for grading and is <strong>different from the invitation link</strong> you used to get here.
        </p>

        <p>
          We recommend bookmarking this page or saving the link in a secure place, such as a password manager:
        </p>

        <p v-if="currentURL !== null" class="fs-95 wrap-anywhere mt-s">
          <span class="verb">{{ currentURL.toString() }}</span>
          <ClipboardButton :text="currentURL.toString()" class="ml-05" hint="Click to copy link"></ClipboardButton>
        </p>
        <LoadingIndicator v-else />

        <h4>Important Warnings</h4>
        <p>
          <strong>1. Don’t lose this link.</strong><br>
          You’ll need it to continue grading and potentially recover your credentials.
          If you lose this link, you might loose access to your grading session, and your progress may be permanently lost.
          Even the service provider cannot recover lost accounts due to privacy protections.
        </p>

        <p>
          <strong>2. Don’t share this link with anyone.</strong><br>
          The link contains your personal access credentials.
          If someone else uses your link, they can impersonate you and grade under your name.
          If another grader needs access to the exam, invite them by creating a separate grader account and sending them their own invitation link.
        </p>

        <input type="checkbox" name="urlSavedBox" id="urlSavedBox" @click="continueButtonEnabled = !continueButtonEnabled"/>
        <label for="urlSavedBox">
          I have saved the link to this page (not the invitation link), for example by bookmarking it or storing it securely.
        </label>

        <div class="flex-row flex-justify-content-end">
          <button @click="stepUi(+1)" :disabled="!continueButtonEnabled">I’ve saved the link, continue</button>
        </div>
      </template>
    </MessageBox>

    <MessageBox v-if="uiState === 1">
      <template #heading>
        Step 2/3) Save the recovery file
      </template>
      <template #content>
        <p>
          Please <strong>download and save</strong> your personal recovery file.
          The recovery file can be used to restore your personal access link in case you loose access to your saved link.
        </p>

        <p>
          We recommend saving the recovery file in a secure place.
        </p>

        <div>
          <button @click="clickOnDownloadRecoveryFile" v-if="!downloadIsLoading">Download personal recovery file</button>
          <LoadingIndicator v-else></LoadingIndicator>
        </div>

        <MessageContainer type="error" v-if="errorMessage !== null">
          {{ errorMessage }}
        </MessageContainer>

        <p>
          <strong>Important: Don't share your recovery file with anyone.</strong> <br/>
          The recovery file contains your personal access credentials.
          If someone else uses your recovery file, they can impersonate you and grade under your name.
        </p>

        <div class="flex-row flex-justify-content-end">
          <button @click="stepUi(+1)" :disabled="!recoveryFileWasDownloaded">I’ve saved the file, continue</button>
        </div>

      </template>
    </MessageBox>

    <MessageBox v-if="uiState === 2">
      <template #heading>
        Step 3/3) Test the recovery file
      </template>
      <template #content>
        <p>
          One final step: Please provide your just downloaded recovery file.
          <a @click="stepUi(-1)" class="clickable">What recovery file?</a>
        </p>

        <input id="recoveryFileUpload" type="file" :accept="RecoveryFile.FILE_ENDING" @change="onRecoveryFileChanged" />

        <MessageContainer type="success" v-if="recoveryFileIsValid">
          All good! The provided recovery file could be used to recover your lost credentials for this exam.
        </MessageContainer>

        <MessageContainer type="error" v-if="errorMessage !== null">
          {{ errorMessage }}
          <a @click="stepUi(-1)" class="clickable">I don’t have a recovery file for this exam.</a>
        </MessageContainer>

        <div class="flex-row flex-justify-content-end">
          <button @click="startGrading" :disabled="!recoveryFileIsValid">Start grading</button>
        </div>

      </template>
    </MessageBox>

  </template>

</template>



<style scoped>

.mt-s {
  margin-top: 0.1rem;
}


</style>