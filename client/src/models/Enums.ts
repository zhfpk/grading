export enum DataState {
    UNLOCKED = 0,
    LOCKED = 1
}

export enum GradingType {
    INDIVIDUAL_GRADING = 1,
    GROUP_GRADING = 2,
    AUTOMATIC_GRADING = 3,
    IMPORTED_GRADING = 4
}

export enum KeyType {
    FILE_KEY = 1,
    AUXILIARY_KEY = 2
}

export enum LocalStorageSettings {
    UI_OVERVIEW_SHOW_NO_SHOWS = "ui.overview-show-no-shows",
    UI_OVERVIEW_REAL_NAMES = "ui.overview-real-names",
    UI_SUBMISSION_WORD_WRAP = "ui.submission-word-wrap",
    UI_SUBMISSION_MONOSPACE_FONT = "ui.submission-monospace-font",
    UI_VISUALIZE_WHITESPACES = "ui.visualize-whitespaces",
    GROUP_GRADING_IGNORE_CAPITALIZATION = "group-grading.ignore-capitalization",
    GROUP_GRADING_TRIM_WHITESPACES = "group-grading.trim-whitespaces",
    UI_INDIVIDUAL_KEEP_POINTS_OPEN = "ui.individual-keep-points-open",
    UI_INDIVIDUAL_KEEP_EXAMINEE_DATA_OPEN = "ui.individual-keep-examinee-data-open",
}