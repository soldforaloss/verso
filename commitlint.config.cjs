/**
 * Conventional Commits enforcement.
 * Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci,
 * chore, revert. Scope is optional (e.g. `feat(viewer): …`).
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always']
  }
}
