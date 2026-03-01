export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // Project uses BEM with double-dash: .chat--header--title
    'selector-class-pattern': null,
    // Selectors are intentionally ordered by logical grouping, not specificity
    'no-descending-specificity': null,
  },
};
