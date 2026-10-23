export const GRADER_TYPES = {
  "reassessment-grader": {
    "name": "Reassessment grader (cannot modify gradings)",
    "permissions": [
        "download-exam-data:task-data", "download-exam-data:exam-phase", "download-exam-data:grade-calculation", "download-exam-data:valid-public-keys",
        "download-examinee-data:anonymized-data:*", "download-examinee-data:file-mapping:*", "download-submission:*:*",
        "download-grading-points:*:*",
        "access-ui:exam-overview", "access-ui:individual-grading", "access-ui:group-grading",
        "download-examinee-data:reassessment-result:*", "upload-reassessment-result:*"
    ]
  },
  "regular-grader": {
    "name": "Regular grader (only anonymized examinee data)",
    "permissions": [
        "download-exam-data:task-data", "download-exam-data:exam-phase", "download-exam-data:grade-calculation", "download-exam-data:valid-public-keys", "download-examinee-data:anonymized-data:*",
        "download-examinee-data:file-mapping:*", "download-submission:*:*",
        "download-grading-points:*:*", "upload-grading-points:*:*",
        "access-ui:exam-overview", "access-ui:individual-grading", "access-ui:group-grading", "access-ui:statistics",
        "download-examinee-data:post-exam-review-accessed:*"
    ]
  },
  "regular-grader-with-personal-data": {
    "name": "Regular grader (with access to personal data)",
    "permissions": [
        "download-exam-data:task-data", "download-exam-data:exam-phase", "download-exam-data:grade-calculation", "download-exam-data:valid-public-keys",
        "download-examinee-data:anonymized-data:*", "download-examinee-data:personal-data:*", "download-examinee-data:file-mapping:*", "download-submission:*:*",
        "download-grading-points:*:*", "upload-grading-points:*:*",
        "access-ui:exam-overview", "access-ui:individual-grading", "access-ui:group-grading", "access-ui:statistics",
        "download-examinee-data:post-exam-review-accessed:*"
    ]
  },
  "full-access": {
    "name": "Grader with full access to all features",
    "permissions": [
        "download-exam-data:task-data", "download-exam-data:exam-phase", "download-exam-data:grade-calculation", "update-exam-data:grade-calculation", "download-exam-data:valid-public-keys",
        "download-examinee-data:anonymized-data:*", "download-examinee-data:personal-data:*", "download-examinee-data:file-mapping:*", "download-submission:*:*",
        "download-grading-points:*:*", "upload-grading-points:*:*",
        "access-ui:exam-overview", "access-ui:individual-grading", "access-ui:group-grading", "access-ui:statistics", "access-ui:points-and-grades",
        "access-ui:lifecycle", "manage-lifecycle:change-phase",
        "access-ui:graders", "download-exam-data:exam-graders", "download-exam-data:exam-graders-personal-data", "manage-graders:delete-grader", "manage-graders:add-grader",
        "access-ui:manage-post-exam-review",
        "download-examinee-data:post-exam-review-accessed:*",
        "download-examinee-data:reassessment-result:*",
        "download-examinee-data:post-exam-review-credentials:*", "download-examinee-data:post-exam-review-accessed:*", "access-ui:manage-post-exam-review", "download-exam-data:post-exam-review-timeframe",
        "access-ui:post-exam-review-invitation", "access-ui:post-exam-review-perform", "post-exam-review:*", "update-exam-data:post-exam-review-timeframe", "upload-reassessment-result:*"
    ]
  }
}


/*

Currently does not exist:
"access-ui:statistics": "Allow access to the statistics page",

*/


export const PermissionsUI = {
    "download-exam-data:task-data": {
        "description": "Allow access to the task information of the exam",
        "visible": false
    },
    "download-exam-data:exam-phase": {
        "description": "Allow access to the current exam phase",
        "visible": false
    },
    "download-exam-data:grade-calculation": {
        "description": "Allow access to the grade calculation (i.e., grades and their point limits)",
        "visible": false
    },
    "update-exam-data:grade-calculation": {
        "description": "Allow to modify the grade's required points for the grade calculation (e.g., adjust the points needed to pass the exam)",
        "visible": true
    },

    "download-examinee-data:anonymized-data:*": {
        "description": "Allow access to the anonymized name of all examinees",
        "visible": false
    },
    "download-examinee-data:personal-data:*": {
        "description": "Allow access to the personal data (i.e., cleartext names) of all examinees",
        "visible": true
    },
    "download-examinee-data:file-mapping:*": {
        "description": "Allow access to the internal file mappings of all examinees",
        "visible": false
    },
    "download-submission:*:*": {
        "description": "Allow access to all submission file of all examinees",
        "visible": false
    },

    "download-grading-points:*:*": {
        "description": "Allow accessing the gradings of the all examinees",
        "visible": true
    },
    "upload-grading-points:*:*": {
        "description": "Allow modifying the gradings of all examinees (i.e., grade submissions)",
        "visible": true
    },

    "download-examinee-data:reassessment-result:*": {
        "description": "Allow access to the reassessment results of all examinees",
        "visible": false
    },
    "upload-reassessment-result:*": {
        "description": "Allow modifying the reassessment results of all examinees (i.e., reassess a failed exam)",
        "visible": true
    },

    "access-ui:exam-overview": {
        "description": "Allow access to the overview page",
        "visible": true
    },
    "access-ui:individual-grading": {
        "description": "Allow access to the individual grading page",
        "visible": true
    },
    "access-ui:group-grading": {
        "description": "Allow access to the group grading page",
        "visible": true
    },

    "access-ui:points-and-grades": {
        "description": "Allow access to the points and grades page",
        "visible": true
    },

    "access-ui:post-exam-review-invitation": {
        "description": "Allow access to the post-exam review invitation page (this is primarily for examinees)",
        "visible": false
    },
    "access-ui:post-exam-review-perform": {
        "description": "Allow access to the actual post-exam review page showing the exam results of an examinee (this is primarily for examinees)",
        "visible": false
    },
    "post-exam-review:*": {
        "description": "Allow to access the post-exam review of all examinees",
        "visible": false
    },
    "access-ui:manage-post-exam-review": {
        "description": "Allow access to the management page for the post-exam review phase (e.g., to set the deadlines and obtain the examinees' invite links)",
        "visible": true
    },
    "download-exam-data:post-exam-review-timeframe": {
        "description": "Allow access to the start and end date for the exam results review by examinees",
        "visible": false
    },
    "update-exam-data:post-exam-review-timeframe": {
        "description": "Allow to modify the start and end date for the exam results review by examinees (i.e., extend the deadline for reviewing)",
        "visible": false
    },
    "download-examinee-data:post-exam-review-credentials:*": {
        "description": "Allow access to the post-exam credentials of all examinees (required for obtaining an examinee's post-exam review invite link)",
        "visible": true
    },
    "download-examinee-data:post-exam-review-accessed:*": {
        "description": "Allow access to whether an examinee visited the post-exam review page for all examinees",
        "visible": true
    },

    "access-ui:lifecycle": {
        "description": "Allow access to the lifecycle page (for changing the exam phase)",
        "visible": true
    },
    "manage-lifecycle:change-phase": {
        "description": "Allow to change the current exam phase (i.e., start reassessment / exam review phase)",
        "visible": false
    },

    "access-ui:graders": {
        "description": "Allow access to the grader management page",
        "visible": true
    },
    "download-exam-data:valid-public-keys": {
        "description": "Allow access to the list of valid public keys used by graders",
        "visible": false
    },
    "download-exam-data:exam-graders": {
        "description": "Allow access to the list of graders (including their permissions but not their real names)",
        "visible": false
    },
    "download-exam-data:exam-graders-personal-data": {
        "description": "Allow access to the personal data of graders",
        "visible": false
    },
    "manage-graders:delete-grader": {
        "description": "Allow deleting existing graders",
        "visible": true
    },
    "manage-graders:add-grader": {
        "description": "Allow adding new graders",
        "visible": true
    },
    "manage-graders:non-deletable": {
        "description": "Prevent other graders from deleting this grader",
        "visible": false
    }
}