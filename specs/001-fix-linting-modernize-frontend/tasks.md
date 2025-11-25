# Tasks: Fix Linting Errors and Modernize Frontend

**Input**: Design documents from `/specs/001-fix-linting-modernize-frontend/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Tests are OPTIONAL for this feature - only validation tests are needed to ensure fixes don't break functionality.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/` for source code
- All paths are relative to repository root

## Phase 1: Setup (Initial Validation)

**Purpose**: Validate current state and prepare for fixes

- [ ] T001 Run linting to capture all current errors in frontend/
- [ ] T002 Run TypeScript compiler to identify type errors: `cd frontend && npx tsc --noEmit`
- [ ] T003 [P] Document current error count and categorize by type (critical errors, hooks, types, patterns)
- [ ] T004 Verify test suite runs successfully before fixes: `cd frontend && yarn test`

**Checkpoint**: Baseline established - ready to begin fixes

---

## Phase 2: Foundational (Critical Errors - Blocking)

**Purpose**: Fix critical errors that prevent compilation or cause runtime issues. MUST complete before user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 [US1] Fix missing useCallback import in frontend/src/components/Fencing/FencingScoreboard.tsx (lines 18, 22)
- [ ] T006 [US1] Verify TypeScript compilation succeeds after critical error fixes: `cd frontend && npx tsc --noEmit`

**Checkpoint**: Foundation ready - critical errors resolved, compilation succeeds

---

## Phase 3: User Story 1 - Fix Critical Linting Errors (Priority: P1) 🎯 MVP

**Goal**: Resolve all critical linting errors so codebase compiles without errors and follows TypeScript best practices.

**Independent Test**: Run `yarn lint` and verify zero errors are reported. TypeScript compilation succeeds with `tsc --noEmit`.

### Implementation for User Story 1

- [ ] T007 [P] [US1] Fix missing imports in frontend/src/components/Fencing/FencingScoreboard.tsx
- [ ] T008 [US1] Verify all critical errors resolved: `cd frontend && yarn lint 2>&1 | grep -i error`
- [ ] T009 [US1] Verify TypeScript compilation: `cd frontend && npx tsc --noEmit`
- [ ] T010 [US1] Run tests to ensure no functionality broken: `cd frontend && yarn test`

**Checkpoint**: At this point, User Story 1 should be complete - all critical errors resolved, compilation succeeds

---

## Phase 4: User Story 2 - Fix React Hooks and Component Patterns (Priority: P1)

**Goal**: Fix React components to follow modern React patterns and hooks best practices, avoiding unnecessary re-renders and bugs.

**Independent Test**: Run `yarn lint` and verify all React hooks warnings are resolved. Components render correctly without console warnings.

### Implementation for User Story 2

- [ ] T011 [P] [US2] Fix React hooks dependency issues in frontend/src/components/Chat/EmojiPicker.tsx (ref access during render, line 314)
- [ ] T012 [P] [US2] Fix React hooks dependency issues in frontend/src/components/Fencing/Fencing.tsx (changeName useCallback, line 173)
- [ ] T013 [P] [US2] Fix React hooks dependency issues in frontend/src/components/Game/Game.tsx (multiple useCallback dependencies, lines 167, 189, 198, 272, 343, 380, 592, 662)
- [ ] T014 [P] [US2] Fix React hooks dependency issues in frontend/src/components/Grid/Grid.tsx (useMemo dependency, line 171)
- [ ] T015 [P] [US2] Fix React hooks dependency issues in frontend/src/components/ListView/ListView.tsx (useCallback dependencies, lines 84, 108, 117)
- [ ] T016 [P] [US2] Fix React hooks dependency issues in frontend/src/components/Player/Editor.tsx (multiple useCallback dependencies, lines 130, 148, 154, 160, 167, 205)
- [ ] T017 [P] [US2] Fix JSX arrow functions in frontend/src/components/Chat/Chat.tsx (lines 498, 726)
- [ ] T018 [P] [US2] Fix JSX arrow functions in frontend/src/components/Chat/EmojiPicker.tsx (line 290)
- [ ] T019 [P] [US2] Fix JSX arrow functions in frontend/src/components/Compose/Create.tsx (lines 194-198)
- [ ] T020 [P] [US2] Fix JSX arrow functions in frontend/src/components/Compose/Hints.tsx (line 125)
- [ ] T021 [P] [US2] Fix JSX arrow functions in frontend/src/components/Fencing/Fencing.tsx (lines 248-251, 310)
- [ ] T022 [P] [US2] Fix JSX arrow functions in frontend/src/components/Fencing/FencingScoreboard.tsx (line 88)
- [ ] T023 [P] [US2] Fix JSX arrow functions in frontend/src/components/Fencing/FencingToolbar.tsx (line 13)
- [ ] T024 [P] [US2] Fix JSX arrow functions in frontend/src/components/Game/Confetti.tsx (line 18)
- [ ] T025 [P] [US2] Fix JSX arrow functions in frontend/src/components/Game/Game.tsx (line 655)
- [ ] T026 [P] [US2] Fix JSX arrow functions in frontend/src/components/Game/PuzzleInfo.tsx (lines 101, 108, 114, 150, 158, 165, 168)
- [ ] T027 [P] [US2] Fix JSX arrow functions in frontend/src/components/Grid/Cell.tsx (lines 87, 188, 189, 215, 216)
- [ ] T028 [P] [US2] Fix JSX arrow functions in frontend/src/components/Grid/Grid.tsx (lines 240, 241)
- [ ] T029 [P] [US2] Fix JSX arrow functions in frontend/src/components/ListView/ListView.tsx (lines 217, 218, 250)
- [ ] T030 [P] [US2] Fix JSX arrow functions in frontend/src/components/Player/Clues.tsx (lines 35, 55, 61, 65)
- [ ] T031 [US2] Verify all React hooks warnings resolved: `cd frontend && yarn lint 2>&1 | grep -i "react-hooks\|jsx-no-bind"`
- [ ] T032 [US2] Test components render without console warnings: Start dev server and manually test affected components

**Checkpoint**: At this point, User Story 2 should be complete - all React hooks and component pattern issues resolved

---

## Phase 5: User Story 3 - Improve TypeScript Type Safety (Priority: P2)

**Goal**: Replace all `any` types and non-null assertions with proper TypeScript types to maintain type safety.

**Independent Test**: Run `yarn lint` and verify no `@typescript-eslint/no-explicit-any` or `@typescript-eslint/no-non-null-assertion` warnings.

### Implementation for User Story 3

- [ ] T033 [P] [US3] Replace `any` types in frontend/src/components/Compose/Hints.tsx (line 7)
- [ ] T034 [P] [US3] Replace `any` types in frontend/src/components/Fencing/transformGameToPlayerProps.ts (lines 32-45)
- [ ] T035 [P] [US3] Replace `any` types in frontend/src/components/Game/Game.tsx (line 184)
- [ ] T036 [P] [US3] Replace `any` types in frontend/src/components/Grid/hashGridRow.ts (line 1)
- [ ] T037 [P] [US3] Replace `any` types in frontend/src/components/Grid/types.ts (line 56)
- [ ] T038 [P] [US3] Replace `any` types in frontend/src/components/Player/ConnectionStats.tsx (lines 16, 17)
- [ ] T039 [P] [US3] Replace `any` types in frontend/src/components/Player/ConnectionStatusIndicator.tsx (lines 24, 25)
- [ ] T040 [P] [US3] Replace `any` types in frontend/src/components/Player/Editor.tsx (lines 43, 46, 72, 73)
- [ ] T041 [P] [US3] Replace non-null assertions in frontend/src/components/Fencing/FencingCountdown.tsx (line 82)
- [ ] T042 [P] [US3] Replace non-null assertions in frontend/src/components/Fencing/transformGameToPlayerProps.ts (lines 59, 82, 89)
- [ ] T043 [P] [US3] Replace non-null assertions in frontend/src/components/Fencing/useGameEvents.ts (line 47)
- [ ] T044 [P] [US3] Replace non-null assertions in frontend/src/components/Fencing/useToolbarActions.ts (line 24)
- [ ] T045 [P] [US3] Replace non-null assertions in frontend/src/components/Grid/Cell.tsx (lines 126, 127, 128)
- [ ] T046 [P] [US3] Replace non-null assertions in frontend/src/components/Grid/Grid.tsx (lines 73, 85)
- [ ] T047 [P] [US3] Replace non-null assertions in frontend/src/components/ListView/ListView.tsx (line 53)
- [ ] T048 [P] [US3] Replace non-null assertions in frontend/src/components/Player/ClueText.ts (lines 15, 26)
- [ ] T049 [P] [US3] Fix bitwise operations in frontend/src/components/Compose/lib/hintUtils.js (lines 9, 20) - replace or document justification
- [ ] T050 [US3] Verify all TypeScript type safety warnings resolved: `cd frontend && yarn lint 2>&1 | grep -i "no-explicit-any\|no-non-null-assertion"`
- [ ] T051 [US3] Verify TypeScript compilation: `cd frontend && npx tsc --noEmit`

**Checkpoint**: At this point, User Story 3 should be complete - all TypeScript type safety issues resolved

---

## Phase 6: User Story 4 - Modernize Code Patterns and Best Practices (Priority: P2)

**Goal**: Modernize code patterns to follow React 19 and TypeScript 5 best practices for maintainability and performance.

**Independent Test**: Run `yarn lint` and verify all warnings are resolved. Code follows React 19 and TypeScript 5 best practices.

### Implementation for User Story 4

- [ ] T052 [P] [US4] Replace array index keys in frontend/src/components/Compose/Create.tsx (line 153)
- [ ] T053 [P] [US4] Replace array index keys in frontend/src/components/Compose/Hints.tsx (line 108)
- [ ] T054 [P] [US4] Replace array index keys in frontend/src/components/Grid/Cell.tsx (lines 44, 66)
- [ ] T055 [P] [US4] Replace array index keys in frontend/src/components/Grid/Grid.tsx (line 223)
- [ ] T056 [P] [US4] Replace array index keys in frontend/src/components/ListView/ListView.tsx (lines 209, 216, 230)
- [ ] T057 [P] [US4] Replace array index keys in frontend/src/components/Player/Clues.tsx (lines 41, 49)
- [ ] T058 [P] [US4] Replace array index keys in frontend/src/components/Player/Editor.tsx (line 252)
- [ ] T059 [P] [US4] Review and fix prop spreading in frontend/src/components/Game/Game.tsx (line 589)
- [ ] T060 [P] [US4] Review and fix prop spreading in frontend/src/components/Grid/Grid.tsx (line 239)
- [ ] T061 [P] [US4] Review and fix prop spreading in frontend/src/components/ListView/ListView.tsx (line 249)
- [ ] T062 [P] [US4] Fix underscore-prefixed variables in frontend/src/components/Game/Game.tsx (line 382: \_handleSelectClue)
- [ ] T063 [P] [US4] Fix underscore-prefixed variables in frontend/src/components/Player/Editor.tsx (line 222: \_isSelected)
- [ ] T064 [P] [US4] Fix consistent-return warning in frontend/src/components/Game/Game.tsx (line 447)
- [ ] T065 [P] [US4] Fix no-shadow warning in frontend/src/components/Chat/EmojiPicker.tsx (line 276: handleKeyDown)
- [ ] T066 [P] [US4] Fix no-nested-ternary in frontend/src/components/Player/Editor.tsx (line 255)
- [ ] T067 [P] [US4] Fix console statements in frontend/src/components/Grid/Cell.tsx (lines 259, 267) - remove or replace with proper logging
- [ ] T068 [US4] Verify all code quality warnings resolved: `cd frontend && yarn lint`
- [ ] T069 [US4] Final validation: Run full lint check and verify zero errors, <10 warnings: `cd frontend && yarn lint`

**Checkpoint**: At this point, User Story 4 should be complete - all code quality warnings resolved

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T070 [P] Run full test suite to ensure no functionality broken: `cd frontend && yarn test`
- [ ] T071 [P] Build frontend to verify no compilation errors: `cd frontend && yarn build`
- [ ] T072 [P] Manual testing: Start dev server and test all affected components
- [ ] T073 [P] Verify no console warnings in browser when running application
- [ ] T074 Document any complex fixes with inline comments where needed
- [ ] T075 Final lint check: `cd frontend && yarn lint` - should show zero errors, <10 warnings
- [ ] T076 Final TypeScript check: `cd frontend && npx tsc --noEmit` - should show zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start immediately after Foundational
  - User Story 2 (P1): Can start immediately after Foundational (can run in parallel with US1)
  - User Story 3 (P2): Can start after Foundational (can run in parallel with US1/US2)
  - User Story 4 (P2): Can start after Foundational (can run in parallel with US1/US2/US3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent, can run in parallel with US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent, can run in parallel with US1/US2
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent, can run in parallel with US1/US2/US3

### Within Each User Story

- All tasks marked [P] can run in parallel (different files)
- Validation tasks should run after all fixes in that story
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All fix tasks within a user story marked [P] can run in parallel (different files)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 2

```bash
# Launch all React hooks fixes in parallel (different files):
Task: "Fix React hooks dependency issues in frontend/src/components/Chat/EmojiPicker.tsx"
Task: "Fix React hooks dependency issues in frontend/src/components/Fencing/Fencing.tsx"
Task: "Fix React hooks dependency issues in frontend/src/components/Game/Game.tsx"
Task: "Fix React hooks dependency issues in frontend/src/components/Grid/Grid.tsx"
Task: "Fix React hooks dependency issues in frontend/src/components/ListView/ListView.tsx"
Task: "Fix React hooks dependency issues in frontend/src/components/Player/Editor.tsx"

# Launch all JSX arrow function fixes in parallel:
Task: "Fix JSX arrow functions in frontend/src/components/Chat/Chat.tsx"
Task: "Fix JSX arrow functions in frontend/src/components/Compose/Create.tsx"
Task: "Fix JSX arrow functions in frontend/src/components/Fencing/Fencing.tsx"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify critical errors resolved, compilation succeeds
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Validate (MVP!)
3. Add User Story 2 → Test independently → Validate
4. Add User Story 3 → Test independently → Validate
5. Add User Story 4 → Test independently → Validate
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (critical errors)
   - Developer B: User Story 2 (React hooks)
   - Developer C: User Story 3 (TypeScript types)
   - Developer D: User Story 4 (code patterns)
3. Stories complete and validate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Validate after each story to catch issues early
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All fixes must maintain existing functionality
- Test after each category of fixes to ensure nothing breaks
