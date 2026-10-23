import {createApp, createSSRApp} from 'vue'
import OverviewApp from './OverviewApp.vue'
import GraderInvitationApp from "./GraderInvitationApp.vue";
import GraderWelcomeApp from "@/GraderWelcomeApp.vue";
import GroupGradingApp from "@/GroupGradingApp.vue";
import PointsAndGradesApp from "@/PointsAndGradesApp.vue";
import ManageGradersApp from "@/ManageGradersApp.vue";
import LifecycleApp from "@/LifecycleApp.vue";
import ManageReviewApp from "@/ManageReviewApp.vue";
import PostExamReviewInvitationApp from "@/PostExamReviewInvitationApp.vue";
import { callInitializePage } from '@/individual-grading'
import ManageCredentialsApp from "@/ManageCredentialsApp.vue";
import CredentialsPresentWarning from "@/components/CredentialsPresentWarning.vue";

function mountApp(appClass, divId) {
    const app = createApp(appClass)
    app.mount("#" + divId)
}


const divToVueAppMapping = new Map([
    ["overviewApp", OverviewApp],
    ["graderInvitationApp", GraderInvitationApp],
    ["graderWelcomeApp", GraderWelcomeApp],
    ["groupGradingApp", GroupGradingApp],
    ["pointsAndGradesApp", PointsAndGradesApp],
    ["manageGradersApp", ManageGradersApp],
    ["lifecycleApp", LifecycleApp],
    ["manageReviewApp", ManageReviewApp],
    ["postExamReviewInvitationApp", PostExamReviewInvitationApp],
    ["manageCredentialsApp", ManageCredentialsApp],
    ["credentialsPresentWarningComponent", CredentialsPresentWarning]
])

if (typeof PAGE_MODE === 'undefined') {
    divToVueAppMapping.forEach(mountApp)
} else {
    callInitializePage()
}



