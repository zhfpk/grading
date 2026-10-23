### Scenario 

You are responsible for a course module at a university and use the presented e-assessment system to conduct your final module examination. The exam takes place in person, under supervision, and on laptops. These laptops are provided by the operator of the exam system. However, you are responsible for the content of your exam and have created tasks that students work on in the browser during the exam. The tasks are open-ended (free-text) questions. Students submit their answer to the questions using input fields in the browser. As the exam is carried out on a laptop, students may also use other software and tools installed on the laptops, e.g., a dictionary or an development environment for programming tasks. Assuming a student wants to strike through all their answers last minute (like students would on paper), the examination system allows to submit blank during the last submission step. 

After the students have completed the exam, their submissions are made available to you for grading via the presented grading software. Once you and your team have graded the exam, you want to allow students to inspect their results using the grading software.

### Current Situation 

The exam has already taken place and now needs to be graded. For this purpose, the service providers have sent you an email with a link inviting you to grade your exam. You have already opened the invitation link in your browser.

### Your tasks 


**Task 1** 
Accept the invitation. Then, start grading your exam.

**Task 2**

**2a.** You would like to get an overview of your examinees: How many students were registeried for the exam?

**2b.** Which students were registered but did not attend the exam (no-shows)?

**2c.** A student contacted you because she cannot remember whether she submitted a blank exam (crossed everything out) or selected the regular option for her answers to be graded. Check whether the fictional student *Sophie Schmidt* submitted a blank exam.

**2d**. You would like to get a rough overview of the students’ answers. To do this, view the exams of any two students individually.

**Task 3**

You now want to begin grading the exam.

**3a.** You decide to grade the _Subtask 1a_ of _Task 1_. You want to start with the question _"Provide the name of the season that follows after winter."_. From creating your tasks, you know that this question expects the answer to be put into the field `1a_season_name`. Grade the submitted answers for this question and award _1 point_ for correct answers. Award _0 points_ for all other cases. For wrong answers, you want to provide the correct answer as grading comment. Some answers contain typos. For correct answers containing typos, add an internal annotation to decide later during grading whether or not to award the _1 point_ for such answers. 

**3b.** You want to continue grading with _Subtask 2c_. Grade all correct submissions with _1 points_; all other submissions should get _0 points_.  


**Task 4**

You know want to invite one of your academic staff members and a student assistant to help with the grading.

**4a.** Invite your academic staff member for grading. 

**4b.** Invite your student assistant. To avoid potential bias, the assistant should not have access to students’ personal data.

### B R E A K 

### New Situation.

Several days have passed, and your staff members have graded most of the exam. You now return to the grading process.

**Task 5**
Your student assistant encountered a few unclear cases while grading and was unsure how to evaluate some submissions. He left internal comments on the respective student submissions. Resolve the unclear cases left by your assistant.

**Task 6**
Ensure that all exams have been fully and consistently graded. 

**Task 7**
Review the grading scale proposed by your academic staff member. For the following grades, set the specified minimum number of points: The exam has a total of 20 points. The grade 1.0 should be awarded starting from 19 points. The required points for each grade decrease by one point. Hence, the minimum number of required points to pass the exam is 10 (resulting in a 4.0). 

**Task 8**

For this scenario, we are now skipping the reassessment phase and assume that grading is completed. Hence, you would like to enable students to review their exam results. You know that you must provide each student with an individual link for exam review.

**8a.** Enable the review period for two weeks starting today.

**8b.** You now want to provide your students with the access links for their review. For this, you need the list of review links.

_Note of the author: In this scenario, the official examiner provides the review links to the examinees. This is also possible although not explicitly described in the paper. No architectural change is needed as the official examiner has access to the personal data of the examinees by default._

**Task 9**
For this scenario, we now assume that students have reviewed their exams. After the students have reviewed their results, you now want to export the final grades and corresponding points.
