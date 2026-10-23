<script setup lang="ts">
import {onMounted, ref} from "vue";
import {LocalCredentialsStore} from "@/models/LocalCredentialsStore";
import MessageContainer from "@/components/base/MessageContainer.vue";
import ExamApi, {getCookies} from "@/models/ExamApi";
import Hidable from "@/components/base/Hidable.vue";
import Modal from "@/components/base/Modal.vue";
import {ExamGrader} from "@/models/ExamGrader";
import NaClCrypto from "@/models/NaClCrypto";
import {RecoveryFile} from "@/models/Exporting";
import {AppError} from "@/models/AppError";

const localCredentialsStore = ref<LocalCredentialsStore>(new LocalCredentialsStore())
const selectedCredentials = ref(null)
const errorMessage = ref(null)
const successfullyRecovered = ref(false)


onMounted(async () => {

});

const onDeleteClick = (credentials) => {
  selectedCredentials.value = credentials
}

const handleDelete = () => {
  if (selectedCredentials.value !== null) {
    localCredentialsStore.value.deleteCredential(selectedCredentials.value.uuid)
    selectedCredentials.value = null
  }
}

const buildWelcomeURL = (credentials) => {
  const queryParameters = new URLSearchParams({
    'exam': credentials.examName,
    'uuid': credentials.uuid
  })
  return '/grading/welcome?' + queryParameters.toString() + "#" + credentials.keys
}

const onRecoveryFileChanged = async (event) => {
  errorMessage.value = null
  successfullyRecovered.value = false

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

    localCredentialsStore.value.addCredential({
      uuid: uploadedRecoveryFile.uuid,
      keys: uploadedRecoveryFile.masterDecryptionPrivateKey + "_" + uploadedRecoveryFile.privateSigningKey,
      examName: uploadedRecoveryFile.examName,
      graderPseudonym: null
    })
    successfullyRecovered.value = true
  } catch(e) {
    if (e instanceof AppError) {
      errorMessage.value = e.message
    } else {
      console.error(e)
      errorMessage.value = "An unhandled error occurred while accepting the invitation. Please try again later."
    }
  }
}

</script>

<template>
  <div>
    <p>
      We store the credentials used to grade your exams in your browser's storage.
      Use this page to manage locally stored credentials for your grader accounts.
    </p>
    <MessageContainer type="info">
      Only one of your exams can be opened at a time.
      You may either use this page or your saved welcome links to switch between exams.
    </MessageContainer>
  </div>

  <div>
    <h4>Stored grader credentials</h4>
    <p>
      The credentials for grader accounts found in your current browser are listed in the table below.
      The table <em>does not contain</em> your potentially saved welcome links, e.g., in bookmarks.
      It also <em>does not contain</em> the credentials of exams opened in another browser or on a separate device.
    </p>
    <p>
      You may delete the credentials from exams you do not need access anymore.
      Deleting the credentials will not delete the exam from the server.
    </p>

    <MessageContainer type="warn">
      Never share these credentials. They are meant for your eyes only!
    </MessageContainer>

    <table>
      <thead>
        <tr>
          <th>Exam identifier</th>
          <th>Grader pseudonym</th>
          <th>UUID</th>
          <th>Key</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="credentials in localCredentialsStore.getAllCredentials()">
          <td>{{ credentials.examName }}</td>
          <td>
            <template v-if="typeof credentials.graderPseudonym === 'string'">{{ credentials.graderPseudonym }}</template>
            <em v-else>Unknown name</em>
          </td>
          <td class="wrap-anywhere mw-10">
            <Hidable><span class="verb smaller">{{ credentials.uuid }}</span></Hidable>
          </td>
          <td class="wrap-anywhere mw-10">
            <Hidable><span class="verb smaller">{{ credentials.keys }}</span></Hidable>
          </td>
          <td>
            <a :href="buildWelcomeURL(credentials)" class="inverted link-button">
              <i class="ri-arrow-right-circle-line"></i> <small>Open exam</small>
            </a>
            <br />
            <a class="link-button" @click="onDeleteClick(credentials)">
              <i class="ri-delete-bin-line" title="Delete credentials"></i><small> Delete credentials</small>
            </a>
          </td>
        </tr>
      </tbody>
    </table>

    <Modal title="Delete credentials" confirm-text="Delete credentials" :visible="selectedCredentials !== null" @confirm="handleDelete" @cancel="selectedCredentials=null">
      <p>Do you want to delete the following credentials?</p>
      <ul class="text-align-left">
        <li>Exam: {{ selectedCredentials.examName }}</li>
        <li>Grader:
          <template v-if="selectedCredentials.graderName !== null">
            {{ selectedCredentials.graderName }}
          </template>
          <em v-else>Unknown name</em>
          (<span class="verb smaller wrap-anywhere">UUID: {{ selectedCredentials.uuid }}</span>)
        </li>
      </ul>
      <MessageContainer type="warn">
        Deleting credentials only removes them from your browser's storage.
        The data of the exam, i.e., submissions and gradings, still remain on the server. <br/>
        Deleting credentials <strong>cannot</strong> be undone.
      </MessageContainer>
  </Modal>
  </div>

  <div>
    <h4>Load recovery file</h4>
    <p>
      In case you have lost access to your personal welcome link, you may provide the corresponding recovery file to regain access to your grader account for the respective exam.
    </p>
    <label for="recoveryFileUpload">Provide your recovery file for the corresponding exam</label>
    <input id="recoveryFileUpload" type="file" :accept="RecoveryFile.FILE_ENDING" @change="onRecoveryFileChanged" />

    <MessageContainer type="error" v-if="errorMessage !== null">
      {{ errorMessage }}
    </MessageContainer>
    <MessageContainer type="info" v-if="successfullyRecovered">
      Added the recovered credentials to the table above.
      Click on the corresponding <em>Open exam</em> button to continue grading.
    </MessageContainer>
  </div>

</template>

<style scoped>
.ri-delete-bin-line {
  color: var(--material-ui-error);
}
a:hover {
  text-decoration: none;
}
</style>
