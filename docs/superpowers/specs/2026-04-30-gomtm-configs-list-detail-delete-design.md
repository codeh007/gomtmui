## Title

GOMTM Configs List and Detail Delete Interaction Design

## Context

The current `/dash/gomtm/configs` page renders a table of config profiles with an `编辑` button and a `复制启动命令` button for each row. The detail route `/dash/gomtm/configs/[name]` already acts as the edit screen by rendering `ConfigEditorView`.

Two UX gaps exist:

1. The list page exposes a separate `编辑` button even though the detail page is already the canonical edit screen.
2. There is no delete action on either the list page or the detail page.

The desired behavior is to make the detail route the primary edit entry and to expose delete from both the list and the detail screens.

## Goals

1. Remove the redundant row-level `编辑` button from the configs list.
2. Make the config title in the list the primary navigation entry into the detail edit page.
3. Add a visible delete action on the list page for each saved config profile.
4. Add a visible delete action on the detail edit page.
5. Keep the existing startup-command copy action available from the list page.

## Non-Goals

1. Do not introduce a separate read-only detail page.
2. Do not redesign the config editor form structure.
3. Do not add a generalized reusable delete-dialog abstraction unless the existing code already requires it.
4. Do not change the backend data model beyond what is required to support deletion through the existing configs API surface.

## Recommended Approach

Use the existing detail route as the single edit destination.

On the list page:

1. Replace the row-level `编辑` button with a clickable title in the name column.
2. Keep `复制启动命令` in the actions column.
3. Add a `删除` button in the actions column.

On the detail page:

1. Keep `ConfigEditorView` as the edit UI.
2. Add a `删除` button in the header action area.
3. After successful deletion, redirect back to `/dash/gomtm/configs`.

This keeps the interaction model simple: the list is for discovery and quick actions, and the detail route is the canonical place to edit or delete a specific config.

## Alternatives Considered

### 1. Row-level click navigation

Make the whole table row clickable instead of only the title.

Rejected because the row already contains action buttons. Combining row navigation with embedded buttons increases accidental-click risk and adds extra event-handling complexity for limited benefit.

### 2. Hide delete inside an overflow menu

Move `复制启动命令` and `删除` into a `more` menu.

Rejected because the request specifically calls out missing delete discoverability. A visible delete action is clearer for this page.

### 3. Delete only from the detail page

Keep the list cleaner and expose deletion only after navigation.

Rejected because the confirmed requirement is to expose deletion from both the list and detail screens.

## UX Details

### List Page

1. The config name remains the first-column primary label.
2. The name becomes the click target that navigates to `/dash/gomtm/configs/[name]`.
3. The description remains as secondary metadata under the name.
4. The actions column contains:
   - `复制启动命令`
   - `删除`
5. The previous `编辑` button is removed entirely.

### Detail Page

1. The current page remains the edit page.
2. The header action cluster in `ConfigEditorView` contains:
   - mode toggle button (`高级 YAML 编辑器` / `返回表单`)
   - `删除`
3. Deleting from the detail page returns the user to the configs list.

### Delete Confirmation

Use a lightweight confirmation step before issuing the delete request.

The implementation may use a browser confirmation or an existing small inline confirmation pattern, but it should stay minimal and should not introduce a new heavy dialog abstraction for this task alone.

## Data and API Design

Add one delete-capable frontend API function in `@/lib/gomtm-configs/api`.

Expected behavior:

1. Accept a config profile name.
2. Call the existing gomtm-configs backend delete endpoint, or add the minimal endpoint support if it does not yet exist.
3. Throw a surfaced error message when the delete request fails.

Mutation behavior:

1. List page delete mutation invalidates the configs list query.
2. Detail page delete mutation invalidates the configs list query and the deleted profile query.
3. Detail page delete mutation redirects to `/dash/gomtm/configs` on success.

## Error Handling

1. Disable the delete button while the delete mutation is pending.
2. Show a success toast on successful deletion.
3. Show an error toast using the surfaced backend message when deletion fails.
4. If the deleted item is no longer available, the list should refresh into the latest server state instead of keeping stale UI.

## Testing Strategy

Follow TDD for the behavior changes.

### List View Tests

Add or update tests to cover:

1. The row-level `编辑` button is no longer rendered.
2. The config name can be clicked to navigate to `/dash/gomtm/configs/[name]`.
3. Clicking `删除` issues the delete request after confirmation.
4. The list query is refreshed or invalidated after successful deletion.

### Editor View Tests

Add or update tests to cover:

1. The detail editor renders a delete button.
2. Clicking delete issues the delete request after confirmation.
3. Successful deletion redirects to `/dash/gomtm/configs`.

### Verification

Run the smallest relevant tests first, then run the project check command:

1. relevant `vitest` specs for configs list/editor
2. `bun run check`

Per current project guidance, this task is a behavior change and should be tested, not treated as style-only UI work.

## Scope Check

This is a single focused feature change touching one feature area:

1. configs list page interaction
2. config detail editor header actions
3. configs API delete support
4. targeted frontend tests

That scope is appropriate for one implementation plan and does not require decomposition.
