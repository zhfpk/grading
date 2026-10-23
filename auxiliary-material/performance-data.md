## performance data 

### Environment
Firefox 147, Intel Core i7-155U, 16 GB RAM

### Collection 

#### Time needed on client-side for decryption and verification 

- time was manually measured 
- used the production system, so no debug output was written to the console
- disabled the browser's cache, only used a single tab with the grading application
- measured the time of decryption and signature verification when loading the overview page (excluding rendering and server loading time)
- used the following code to measure the time for submissions and grading in individual runs (as alert interrupts)


```javascript 

// start of the method 
// -> fetch call 

// measurement start
let start = performance.now()

// ... awaited decryption including signature verification for all blobs

let end = performance.now()

alert("time needed" + (end-start).toString() + "ms")

```

- wrote down the displayed time 
- calculated the corresponding averages for submissions and gradings and added the averages
- repeated this experiment for the example exam (the one provided in the server files) and the largest real-world exam (not provided as it is real-world data)

#### Time needed for grading 

- used same manual approach as above to measure the time when the grading is fully entered and submitted (by pressing ENTER) until the save method reaches the end. 
- this time, storage time on the server was included 
- used the individual grading page as group grading grades multiple submissions at the same time 
- relevant parts in the code: `triggerSaving` function in `GradingInputContainer.vue` 

#### Importer time 

Reran the import of the large exam and measured from beginning to end. Always completed well below one minute (when removing the `input` as this otherwise adds user delay)

### Results on client-side decryption + verification measurement

#### Example exam (provided)

Exam with 39 examinees and 11 questions, resulting in approximately 500 answer blobs. 

```python 

import statistics

time_submissions = [ 502, 526, 503, 939, 544, 917, 515, 524, 503, 523, 625, 738, 515, 505, 543, 518, 550, 921, 531, 513 ]

mean_submissions = statistics.mean(time_submissions)

print("Example exam @ submissions: count:", len(time_submissions), "mean:", mean_submissions)

time_gradings = [ 439, 436, 425, 525, 430, 429, 431, 432, 432, 429, 433, 435, 444, 437, 486, 427, 454, 452, 444, 438]

mean_gradings = statistics.mean(time_gradings)

print("Example exam @ gradings: count:", len(time_gradings), "mean:", mean_gradings)

print("sum mean:", mean_gradings + mean_submissions)

```

#### Largest real-world exam (cannot be provided)

Exam with 210 examinees and 22 questions, resulting in approximately 5000 answer blobs. 

```python 

import statistics

time_submissions = [ 953, 802, 860, 858, 878, 938, 910, 899, 804, 849, 878, 857, 896, 874, 903, 1208, 899, 919, 840, 921 ]

mean_submissions = statistics.mean(time_submissions)

print("Largest exam @ submissions: count:", len(time_submissions), "mean:", mean_submissions)

time_gradings = [ 816, 817, 811, 822, 818, 803, 840, 834, 832, 835, 830, 824, 856, 861, 841, 846, 841, 859, 854, 827 ]

mean_gradings = statistics.mean(time_gradings)

print("Largest exam @ gradings: count:", len(time_gradings), "mean:", mean_gradings)

print("sum mean:", mean_gradings + mean_submissions)

```

### Results for time needed for grading 

```python 

import statistics

grading = [19, 18, 21, 20, 20, 21, 17, 23, 19, 20, 20, 19, 17, 18, 27, 21, 23, 29, 19, 23]


print("Grading: count:", len(grading), "mean:", statistics.mean(grading))

```