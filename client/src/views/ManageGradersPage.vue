<script setup lang="ts">

import {onMounted, ref} from "vue";
import ExamApi from "@/models/ExamApi";
import {ExamGrader, ExamGraders} from "@/models/ExamGrader";
import Modal from "@/components/base/Modal.vue";
import MessageContainer from "@/components/base/MessageContainer.vue";
import {GRADER_TYPES, PermissionsUI} from "@/models/PermissionsUI";
import ClipboardButton from "@/components/base/ClipboardButton.vue";
import {AppError} from "@/models/AppError";
import LockedIcon from "@/components/base/LockedIcon.vue";
import Hidable from "@/components/base/Hidable.vue";

const examApi = new ExamApi()

const examGraders = ref(new ExamGraders([]))

const selectedGrader = ref(null)

const enteredGraderRealName = ref("")

const selectedGraderType = ref("choose")

const deleteModalVisible = ref(false)
const graderDetailsVisible = ref(false)

const createdUser = ref(null)
const errorMessage = ref(null)

const showAllPermissions = ref(false)


onMounted(async () => {
  await examApi.initialize()

  await refreshExamGraderList()

  console.log("Graders", examGraders.value)

});

const refreshExamGraderList = async () => {
  examGraders.value = await examApi.getExamGraders()
}

const handleDelete = async () => {
  const selectedGraderName = selectedGrader.value.name
  deleteModalVisible.value = false
  selectedGrader.value = null

  try {
    await examApi.deleteExamGraderUser(selectedGraderName)
    await refreshExamGraderList()
  } catch (e) {
    errorMessage.value = e.message
  }
}

const onDeleteClick = (grader: ExamGrader) => {
  selectedGrader.value = grader
  deleteModalVisible.value = true
}

const onViewPermissionsClick = (grader: ExamGrader) => {
  selectedGrader.value = grader
  graderDetailsVisible.value = true
  selectedGraderType.value = "choose"
}

const handleAddGrader = async () => {
  errorMessage.value = null
  createdUser.value = null

  let graderPermissions = null
  if (GRADER_TYPES.hasOwnProperty(selectedGraderType.value)) {
    graderPermissions = GRADER_TYPES[selectedGraderType.value].permissions
  } else {
    return;
  }

  if (enteredGraderRealName.value.trim().length === 0) {
    errorMessage.value = "You need to provide a real name for the grader"
    return;
  }

  try {
    createdUser.value = await examApi.createExamGraderUser(enteredGraderRealName.value, graderPermissions)
    await refreshExamGraderList()
  } catch (e) {
    if (e instanceof AppError) {
      errorMessage.value = e.message
    } else {
      console.error(e)
      errorMessage.value = "Unhandled error when creating the grader."
    }
  }
}

</script>

<template>

  <div>
    <p>
      This page allows to manage graders.
      You may add new graders or delete existing graders including all their gradings.
      When a reassessment grader is deleted, the reassessments done by the respective grader become invalid automatically.
      As there is no personal information on graders stored on the server-side, all graders have names of German cities as their anonymous identifiers.
    </p>
    <p class="mb-0">
      The account states have the following meaning:
    </p>
    <ul class="mt-05">
      <li>invited: The corresponding grader is invited but did accept the invitation yet.</li>
      <li>active: The corresponding grader can access the data of this exam depending on the grader's permissions.</li>
<!--        <li>deactivated: The corresponding grader has no longer access to this exam. The gradings done by this grader remain valid.</li>-->
    </ul>
  </div>

  <table>
    <thead>
      <tr>
        <th>Grader pseudonym</th>
        <th>Grader real name</th>
        <th>Account state</th>
        <th>Actions</th>
      </tr>
    </thead>

    <tbody>
      <tr v-for="grader in examGraders.graders">
        <td>{{ grader.pseudonym }} <span v-if="grader.self">(You)</span></td>
        <td>
          <Hidable v-if="grader.isRealNameAccessible()">{{ grader.realName }}</Hidable>
          <span v-else><LockedIcon/> Hidden</span>
        </td>
        <td>{{ grader.state }}</td>
        <td>
          <a class="link-button" @click="onViewPermissionsClick(grader)">
            <i class="ri-list-view" title="View permissions"></i><small>View permissions</small>
            <br />
          </a>

<!--          <a class="link-button" @click="onDeactivateClick(grader)" v-if="!grader.self && examApi.userHasPermission('manage-graders:deactivate-grader') && !grader.hasPermission('manage-graders:non-deactivatable')">-->
<!--            <i class="ri-close-large-fill" title="Deactivate grader"></i><small>Deactivate grader</small>-->
<!--            <br />-->
<!--          </a>-->

          <a class="link-button" @click="onDeleteClick(grader)" v-if="!grader.self && examApi.userHasPermission('manage-graders:delete-grader') && !grader.hasPermission('manage-graders:non-deletable')">
            <i class="ri-delete-bin-line" title="Delete grader"></i><small>Delete grader</small>
          </a>
        </td>
      </tr>
    </tbody>
  </table>

  <Modal title="Delete grader" :visible="deleteModalVisible" @confirm="handleDelete" @cancel="deleteModalVisible=false">
    <p>Do you want to delete the selected grader <em>{{ selectedGrader.name }}</em>?</p>
    <p>This will revoke any access of the grader to the exam. Hence, the grader cannot see examinee submissions nor see or change modify gradings.</p>
    <MessageContainer type="warn">
      <strong>Warning:</strong> Deleting a grader will <strong>delete</strong> all gradings done by the respective grader.
      This action <strong>cannot</strong> be undone.
    </MessageContainer>
  </Modal>

<!--  <Modal title="Deactivate grader" :visible="deactivateModalVisible" @confirm="handleDeactivate" @cancel="deactivateModalVisible=false">-->
<!--    <p>Do you want to deactivate the selected grader <em>{{ selectedGrader.name }}</em>?</p>-->
<!--    <p>This will revoke any access of the grader to the exam. Hence, the grader cannot see examinee submissions nor see or modify any gradings.</p>-->
<!--    <MessageContainer type="info">-->
<!--      <strong>Note:</strong> Deactivating a grader will <strong>preserve</strong> all gradings done by this grader.-->
<!--    </MessageContainer>-->
<!--    <MessageContainer type="warn">-->
<!--      <strong>Warning:</strong> Deactivating a grader cannot be undone.-->
<!--    </MessageContainer>-->
<!--  </Modal>-->

  <div>
    <MessageContainer type="error" v-if="errorMessage !== null">
      {{ errorMessage }}
    </MessageContainer>
  </div>

  <div>
    <select v-model="selectedGraderType" @change="selectedGrader = null">
      <option value="choose">-- Choose the role of the grader to add --</option>
      <option v-for="(graderDetails, graderType) in GRADER_TYPES" :value="graderType">{{ graderDetails.name }}</option>
    </select>
    &nbsp;
    <input type="text" v-model="enteredGraderRealName" placeholder="Real name of grader" :disabled="selectedGraderType === 'choose'">
    &nbsp;
    <button @click="handleAddGrader" :disabled="selectedGraderType === 'choose'">Create grader</button>

    <MessageContainer type="success" v-if="createdUser !== null">
      Successfully created grader account. Provide the following invitation link to the person you want to invite as grader. <br/>
      <br/>
      <strong>Invitation link: </strong><span class="wrap-anywhere fs-95 verb">{{ examApi.buildGraderInvitationURL(createdUser.uuid, createdUser.masterEncryptionPrivateKeyHex) }}</span>
      <ClipboardButton icon="ri-share-fill" :text="examApi.buildGraderInvitationURL(createdUser.uuid, createdUser.masterEncryptionPrivateKeyHex)" class="ml-05"/>

      <MessageContainer type="warn">
        Make sure to copy this link as it cannot be recovered.
      </MessageContainer>
    </MessageContainer>
  </div>

  <div v-if="graderDetailsVisible || selectedGraderType !== 'choose'" class="detailsBox">
    <div>
      <strong>
        <template v-if="selectedGrader !== null">View grader {{ selectedGrader.name }}</template>
        <template v-else>Add new grader</template>
      </strong>
      &mdash;
      <a class="plain-link" @click="showAllPermissions=!showAllPermissions">
        <template v-if="showAllPermissions">Show only important permissions</template>
        <template v-else>Show all permissions</template>
      </a>

    </div>

    <div class="permission-container">
      <div v-for="(descriptionObject, permission) in PermissionsUI">
        <template v-if="showAllPermissions || descriptionObject.visible">
          <template v-if="selectedGrader !== null">
            <i v-if="selectedGrader.hasPermission(permission)" class="ri-check-line" title="Grader HAS permission"></i>
            <i v-else class="ri-close-large-fill" title="Grader does NOT have permission"></i>
          </template>
          <template v-else-if="Object.keys(GRADER_TYPES).includes(selectedGraderType)">
            <i v-if="GRADER_TYPES[selectedGraderType].permissions.includes(permission)" class="ri-check-line" title="Grader HAS permission"></i>
            <i v-else class="ri-close-large-fill" title="Grader does NOT have permission"></i>
          </template>

          {{ descriptionObject.description }}
        </template>
      </div>
    </div>
  </div>


  <h5>FAQ</h5>

  <p>
    <em>I've invited another grader but lost their invitation link. How can I proceed?</em> <br />
    In this case, you should delete the corresponding grader account and create a new grader account.
  </p>

  <p>
    <em>A fellow grader, who already graded submissions has lost his personal link. Can I recover the link?</em> <br />
    No. In such a case, you should consider deleting the corresponding grader account. Note that this will also delete the gradings done by the lost grader account. Alternatively, you may keep the grader account and create a new grader account to invite the fellow grader again.
  </p>

  <p>
    <em>Can I modify the permissions of an already existing grader?</em> <br />
    No.
  </p>

</template>

<style scoped>

.permission-container {
  display: flex;
  flex-direction: column;
}

.detailsBox {
  border: 1px solid gray;
  border-radius: 0.5rem;
  margin-top: 1rem;
  padding: 1.0rem;
}

.ri-close-large-fill, .ri-delete-bin-line {
  color: var(--material-ui-error);
}

.ri-check-line {
  color: green;
}

</style>