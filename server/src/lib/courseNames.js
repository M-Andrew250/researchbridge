// Mirrors the courseCatalog maps duplicated across the frontend
// pages (enrol.html, dashboard.html, etc.) — kept here too since the
// backend needs course display names for email content.
export const courseNames = {
  excel: 'Excel for Professionals',
  python: 'Python for Data Science',
  stata: 'Stata for Econometrics',
  spss: 'SPSS for Statistical Analysis',
  r: 'R for Statistical Computing',
  nvivo: 'NVivo for Qualitative Research',
  powerbi: 'Power BI for Data Visualization',
  kobo: 'KoBoToolbox for Data Collection',
  // Catch-all options on the general enrolment form (pages/enrol.html)
  // for a visitor who doesn't know which specific tool they want yet
  // — not real courses with their own curriculum/e-learning content,
  // just a lead for the team to follow up on and help pick the right
  // one. "other"'s actual free-text description lives in the
  // enrolment's comments field, since there's no dedicated column for it.
  'data-analysis-general': 'Any Course Related to Data Analysis',
  other: 'Other (see comments)',
};
