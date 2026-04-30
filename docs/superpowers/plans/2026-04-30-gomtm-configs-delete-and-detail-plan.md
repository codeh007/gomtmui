# GOMTM Configs Delete And Detail Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add end-to-end config profile deletion and make the config title, not a row-level edit button, the primary entry into the existing detail edit page.

**Architecture:** Implement the feature as a three-layer vertical slice: add a database delete RPC in the main `gomtm` repo, expose it through the existing `gomtmui` control-plane route and API client, then update the configs list and editor UI to use that capability. Keep the detail page as the canonical edit page, use lightweight confirmation, and verify each layer with targeted tests before moving upward.

**Tech Stack:** PostgreSQL RPC on Supabase, pgTAP, Hono route handlers, Next.js App Router, React, TanStack Query, Vitest, Testing Library, Bun typecheck.

---

## File Structure

### Main repo: database and DB-derived types
- Modify: `/workspace/gomtm/supabase/tests/database/208_gomtm_config_profiles.test.sql`
  - Extend the config-profile contract test to cover delete permission checks and successful deletion.
- Modify: `/workspace/gomtm/packages/mtmsdk/src/types/database.types.ts`
  - Regenerated DB-derived types after the new delete RPC is added.
- Direct Dev DB change via `psql`
  - Create `public.gomtm_config_profile_delete(p_name text)` in the Dev database. This repo does not use migration files.

### UI repo: backend route and frontend API
- Modify: `/workspace/gomtmui/src/server/routes/gomtm-configs/index.test.ts`
  - Add route tests for `DELETE /api/cf/gomtm/config-profiles/:name`.
- Modify: `/workspace/gomtmui/src/server/routes/gomtm-configs/index.ts`
  - Add the delete route and its RPC wiring.
- Modify: `/workspace/gomtmui/src/lib/gomtm-configs/api.ts`
  - Add `deleteConfigProfile(name)`.

### UI repo: list/detail UX and tests
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-list-view.test.tsx`
  - Add tests for clickable title navigation, missing row edit button, and delete action.
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-list-view.tsx`
  - Remove row edit button, make title clickable, add row delete action.
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-editor-view.test.tsx`
  - Add tests for detail-page delete and redirect.
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-editor-view.tsx`
  - Add detail delete button and redirect-on-success behavior.

### Verification
- Run in `/workspace/gomtm`:
  - `bash testing/db-testing.sh supabase/tests/database/208_gomtm_config_profiles.test.sql`
  - `GOTOOLCHAIN=go1.26.2+auto go run ./cmd db typegen`
- Run in `/workspace/gomtmui`:
  - `bun vitest src/server/routes/gomtm-configs/index.test.ts`
  - `bun vitest src/components/gomtm-configs/config-list-view.test.tsx src/components/gomtm-configs/config-editor-view.test.tsx`
  - `bun run check`

## Pre-Edit Notes

- There is currently no `gomtm_config_profile_delete` symbol in either repo. The feature requires new delete capability rather than merely wiring an existing endpoint.
- Existing config profile behavior already uses the detail route as the edit page: `/dash/gomtm/configs/[name]` renders `ConfigEditorView`.
- Existing delete UX patterns in this repo use `window.confirm(...)` in simple cases. For this task, keep confirmation lightweight instead of introducing a new dialog abstraction.
- Before editing any existing symbol in `gomtmui`, run GitNexus impact analysis and report the blast radius if risk rises to HIGH or CRITICAL.

---

### Task 1: Add and verify the database delete RPC in `gomtm`

**Files:**
- Modify: `/workspace/gomtm/supabase/tests/database/208_gomtm_config_profiles.test.sql`
- Modify: `/workspace/gomtm/packages/mtmsdk/src/types/database.types.ts`
- Direct Dev DB change: `public.gomtm_config_profile_delete(p_name text)` via `psql`

- [ ] **Step 1: Write the failing pgTAP assertions for delete permission and delete success**

Add these assertions to `/workspace/gomtm/supabase/tests/database/208_gomtm_config_profiles.test.sql`:

```sql
SELECT throws_ok(
  $$SELECT public.gomtm_config_profile_delete('task3-profile')$$,
  'P4030',
  'Access denied',
  'member cannot delete gomtm config profiles'
);

SELECT lives_ok(
  $$SELECT public.gomtm_config_profile_delete('task3-profile')$$,
  'admin can delete an existing gomtm config profile'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.gomtm_config_profile_list_cursor(200, 0)
    WHERE name = 'task3-profile'
  ),
  0::bigint,
  'deleted config profile is removed from the list cursor'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.gomtm_config_profile_get('task3-profile')
  ),
  0::bigint,
  'deleted config profile no longer appears in get'
);
```

Also update the test plan count at the top from `SELECT plan(16);` to `SELECT plan(20);`.

- [ ] **Step 2: Run the pgTAP file to verify it fails because delete RPC does not exist yet**

Run:

```bash
bash testing/db-testing.sh supabase/tests/database/208_gomtm_config_profiles.test.sql
```

Expected: FAIL with an error equivalent to `function public.gomtm_config_profile_delete(unknown) does not exist` or another failure caused by the missing delete RPC.

- [ ] **Step 3: Create the minimal delete RPC directly in the Dev database**

Run:

```bash
source env/dev.env && psql "$SUPABASE_DATABASE_URL" <<'SQL'
CREATE OR REPLACE FUNCTION public.gomtm_config_profile_delete(
  p_name text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'P4030';
  end if;

  if not public.has_permission('sys_config', 'write') then
    raise exception 'Access denied' using errcode = 'P4030';
  end if;

  if v_name = '' then
    raise exception 'Profile name is required' using errcode = 'P0001';
  end if;

  DELETE FROM public.gomtm_config_profiles
  WHERE name = v_name;

  RETURN FOUND;
end;
$function$;

COMMENT ON FUNCTION public.gomtm_config_profile_delete(text)
IS 'Delete one gomtm config profile by name';
SQL
```

- [ ] **Step 4: Re-run the pgTAP file to verify delete behavior passes**

Run:

```bash
bash testing/db-testing.sh supabase/tests/database/208_gomtm_config_profiles.test.sql
```

Expected: PASS.

- [ ] **Step 5: Regenerate DB-derived types so `gomtmui` can call the new RPC without stale contracts**

Run:

```bash
GOTOOLCHAIN=go1.26.2+auto go run ./cmd db typegen
```

Expected: exit code `0` and an updated `/workspace/gomtm/packages/mtmsdk/src/types/database.types.ts` containing `gomtm_config_profile_delete`.

- [ ] **Step 6: Commit the DB contract change**

```bash
git add supabase/tests/database/208_gomtm_config_profiles.test.sql packages/mtmsdk/src/types/database.types.ts
git commit -m "feat: add gomtm config profile delete rpc"
```

---

### Task 2: Expose config-profile delete from the `gomtmui` control-plane route

**Files:**
- Modify: `/workspace/gomtmui/src/server/routes/gomtm-configs/index.test.ts`
- Modify: `/workspace/gomtmui/src/server/routes/gomtm-configs/index.ts`

- [ ] **Step 1: Run GitNexus impact analysis before editing the route symbols**

Targets to inspect before touching code:

1. `gomtmConfigsRoute`
2. `getAuthenticatedSupabase`

Record the result. If GitNexus reports HIGH or CRITICAL risk, stop and report the blast radius before editing.

- [ ] **Step 2: Write the failing route tests for delete success and not-found behavior**

Add these tests to `/workspace/gomtmui/src/server/routes/gomtm-configs/index.test.ts`:

```ts
it("deletes a config profile through the control-plane API", async () => {
  rpc.mockResolvedValueOnce({
    data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :8383\n" }],
    error: null,
  });
  rpc.mockResolvedValueOnce({
    data: true,
    error: null,
  });

  const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
    method: "DELETE",
    headers: trustedDashboardHeaders,
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(rpc).toHaveBeenNthCalledWith(1, "gomtm_config_profile_get", {
    p_name: "custom1",
  });
  expect(rpc).toHaveBeenNthCalledWith(2, "gomtm_config_profile_delete", {
    p_name: "custom1",
  });
});

it("returns 404 when deleting a missing config profile", async () => {
  rpc.mockResolvedValueOnce({
    data: [],
    error: null,
  });

  const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/missing", {
    method: "DELETE",
    headers: trustedDashboardHeaders,
  });

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "not found" });
  expect(rpc).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run the route test file to verify the new delete tests fail**

Run:

```bash
bun vitest src/server/routes/gomtm-configs/index.test.ts
```

Expected: FAIL because `DELETE /config-profiles/:name` is not implemented.

- [ ] **Step 4: Implement the minimal delete route in `gomtmConfigsRoute`**

Add this handler to `/workspace/gomtmui/src/server/routes/gomtm-configs/index.ts` near the other `config-profiles/:name` handlers:

```ts
gomtmConfigsRoute.delete("/config-profiles/:name", async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const profileName = c.req.param("name");
  const currentProfile = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_get", {
    p_name: profileName,
  });
  if (currentProfile.error) {
    return createControlPlaneRpcErrorResponse(c, currentProfile.error, "failed to delete config profile");
  }

  const existingProfile = normalizeSingletonRpcRow(currentProfile.data);
  if (existingProfile.multiple) {
    return c.json({ error: "failed to delete config profile" }, 500);
  }
  if (!existingProfile.record) {
    return c.json({ error: "not found" }, 404);
  }

  const { data, error } = await auth.supabase.rpc<boolean>("gomtm_config_profile_delete", {
    p_name: profileName,
  });
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to delete config profile");
  }

  return c.json({ success: Boolean(data) });
});
```

- [ ] **Step 5: Re-run the route tests to verify they pass**

Run:

```bash
bun vitest src/server/routes/gomtm-configs/index.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the route-layer delete support**

```bash
git add src/server/routes/gomtm-configs/index.ts src/server/routes/gomtm-configs/index.test.ts
git commit -m "feat: add gomtm config profile delete route"
```

---

### Task 3: Add the frontend API client for config-profile deletion

**Files:**
- Modify: `/workspace/gomtmui/src/lib/gomtm-configs/api.ts`

- [ ] **Step 1: Write the failing API test inside the list or editor view flow**

Because this file currently has no dedicated unit test, make the first failing proof come from the UI tests that will import `deleteConfigProfile`. In those tests, extend the module mock to include:

```ts
const deleteConfigProfile = vi.fn();

vi.mock("@/lib/gomtm-configs/api", () => ({
  fetchConfigProfiles: (...args: unknown[]) => fetchConfigProfiles(...args),
  fetchStartupCommand: (...args: unknown[]) => fetchStartupCommand(...args),
  deleteConfigProfile: (...args: unknown[]) => deleteConfigProfile(...args),
}));
```

Expected initial failure later: import/runtime failure because the production module does not export `deleteConfigProfile` yet.

- [ ] **Step 2: Add the minimal `deleteConfigProfile(name)` implementation**

Append this function to `/workspace/gomtmui/src/lib/gomtm-configs/api.ts`:

```ts
export async function deleteConfigProfile(name: string) {
  const response = await fetch(`/api/cf/gomtm/config-profiles/${encodeURIComponent(name)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return (await response.json()) as { success: boolean };
}
```

- [ ] **Step 3: Use this export in the upcoming UI tests and verify the import error is gone**

Run:

```bash
bun vitest src/components/gomtm-configs/config-list-view.test.tsx src/components/gomtm-configs/config-editor-view.test.tsx
```

Expected: the suite should now fail on missing UI behavior rather than a missing API export.

- [ ] **Step 4: Commit the frontend API addition**

```bash
git add src/lib/gomtm-configs/api.ts
git commit -m "feat: add gomtm config profile delete client"
```

---

### Task 4: Update the configs list page to use title navigation and row delete

**Files:**
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-list-view.test.tsx`
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-list-view.tsx`

- [ ] **Step 1: Run GitNexus impact analysis before editing list symbols**

Targets to inspect before editing:

1. `ConfigListView`
2. `formatTimestamp`

Record the result. If risk is HIGH or CRITICAL, stop and report it before editing.

- [ ] **Step 2: Write the failing list-view tests for title navigation and delete**

Update `/workspace/gomtmui/src/components/gomtm-configs/config-list-view.test.tsx` with:

1. a `deleteConfigProfile` mock in the API mock block
2. a `window.confirm` stub
3. a new behavior test

Add this test:

```ts
it("navigates through the config title, removes the row edit button, and deletes after confirmation", async () => {
  fetchConfigProfiles.mockResolvedValue({
    items: [
      {
        name: "custom1",
        description: "Demo profile",
        updated_at: "2026-04-29T03:00:00Z",
      },
    ],
  });
  deleteConfigProfile.mockResolvedValue({ success: true });
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

  renderView();

  await screen.findByText("custom1");

  expect(screen.queryByRole("button", { name: "编辑" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "custom1" }));
  expect(pushMock).toHaveBeenCalledWith("/dash/gomtm/configs/custom1");

  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => {
    expect(deleteConfigProfile).toHaveBeenCalledWith("custom1");
  });
});
```

- [ ] **Step 3: Run the list-view test file to verify it fails on the missing UI behavior**

Run:

```bash
bun vitest src/components/gomtm-configs/config-list-view.test.tsx
```

Expected: FAIL because the row still renders `编辑`, the title is not clickable, and no delete button exists.

- [ ] **Step 4: Implement the minimal list-view behavior**

In `/workspace/gomtmui/src/components/gomtm-configs/config-list-view.tsx`:

1. Replace `Edit3` with `Trash2` in the icon import.
2. Import `useQueryClient` and `deleteConfigProfile`.
3. Add a delete mutation that confirms first, deletes, then invalidates `CONFIG_PROFILES_QUERY_KEY`.
4. Remove the `编辑` button.
5. Make the config title a button that pushes to `/dash/gomtm/configs/${item.name}`.
6. Add a `删除` button to the action group.

The key additions should look like this:

```ts
const queryClient = useQueryClient();

const deleteMutation = useMutation({
  mutationFn: deleteConfigProfile,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
    toast.success("配置已删除");
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "删除配置失败");
  },
});
```

And inside the row:

```tsx
<TableCell>
  <div className="flex flex-col items-start gap-1">
    <Button type="button" variant="link" className="h-auto p-0 font-medium" onClick={() => router.push(`/dash/gomtm/configs/${item.name}`)}>
      {item.name}
    </Button>
    {metadata ? <div className="text-xs text-muted-foreground">{metadata}</div> : null}
  </div>
</TableCell>
```

And the delete action:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  disabled={deleteMutation.isPending}
  onClick={() => {
    if (!window.confirm(`确定要删除配置 ${item.name} 吗？`)) {
      return;
    }
    deleteMutation.mutate(item.name);
  }}
>
  <Trash2 className="mr-2 h-4 w-4" />
  删除
</Button>
```

- [ ] **Step 5: Re-run the list-view tests to verify they pass**

Run:

```bash
bun vitest src/components/gomtm-configs/config-list-view.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the list UX change**

```bash
git add src/components/gomtm-configs/config-list-view.tsx src/components/gomtm-configs/config-list-view.test.tsx
git commit -m "feat: update gomtm config list actions"
```

---

### Task 5: Add delete to the detail editor and redirect back to the list

**Files:**
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-editor-view.test.tsx`
- Modify: `/workspace/gomtmui/src/components/gomtm-configs/config-editor-view.tsx`

- [ ] **Step 1: Run GitNexus impact analysis before editing editor symbols**

Targets to inspect before editing:

1. `ConfigEditorView`
2. `hasUnsavedNewProfile`
3. `getSaveErrorMessage`

Record the result. If risk is HIGH or CRITICAL, stop and report it before editing.

- [ ] **Step 2: Write the failing editor test for detail delete and redirect**

Update the module mock in `/workspace/gomtmui/src/components/gomtm-configs/config-editor-view.test.tsx` to include `deleteConfigProfile`, then add this test:

```ts
it("deletes the current profile from the detail editor and redirects back to the list", async () => {
  deleteConfigProfile.mockResolvedValue({ success: true });
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

  renderView();

  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => {
    expect(deleteConfigProfile).toHaveBeenCalledWith("custom1");
  });
  expect(replaceMock).toHaveBeenCalledWith("/dash/gomtm/configs");
});
```

- [ ] **Step 3: Run the editor test file to verify it fails on missing delete behavior**

Run:

```bash
bun vitest src/components/gomtm-configs/config-editor-view.test.tsx
```

Expected: FAIL because the editor does not yet render a delete button.

- [ ] **Step 4: Implement the minimal detail delete behavior**

In `/workspace/gomtmui/src/components/gomtm-configs/config-editor-view.tsx`:

1. Import `Trash2` and `deleteConfigProfile`.
2. Add a `deleteMutation` using `useMutation`.
3. Invalidate `CONFIG_PROFILES_QUERY_KEY` and the current profile query on success.
4. Redirect with `router.replace("/dash/gomtm/configs")` on success.
5. Render a `删除` button in the header action cluster for existing profiles only.
6. Keep delete hidden for unsaved new profiles.

The key mutation should look like this:

```ts
const deleteMutation = useMutation({
  mutationFn: deleteConfigProfile,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: ["gomtm-config-profile", profile.name] });
    toast.success("配置已删除");
    router.replace("/dash/gomtm/configs");
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "删除配置失败");
  },
});
```

And the button should look like this:

```tsx
{!isUnsavedNewProfile ? (
  <Button
    type="button"
    variant="outline"
    disabled={deleteMutation.isPending}
    onClick={() => {
      if (!window.confirm(`确定要删除配置 ${profile.name} 吗？`)) {
        return;
      }
      deleteMutation.mutate(profile.name);
    }}
  >
    <Trash2 className="mr-2 h-4 w-4" />
    删除
  </Button>
) : null}
```

- [ ] **Step 5: Re-run the editor tests to verify they pass**

Run:

```bash
bun vitest src/components/gomtm-configs/config-editor-view.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the detail delete behavior**

```bash
git add src/components/gomtm-configs/config-editor-view.tsx src/components/gomtm-configs/config-editor-view.test.tsx
git commit -m "feat: add gomtm config detail delete action"
```

---

### Task 6: Run the final verification commands across both repos

**Files:**
- No new files; verification only

- [ ] **Step 1: Re-run the DB contract test in `/workspace/gomtm`**

Run:

```bash
bash testing/db-testing.sh supabase/tests/database/208_gomtm_config_profiles.test.sql
```

Expected: PASS.

- [ ] **Step 2: Re-run the gomtm config route tests in `/workspace/gomtmui`**

Run:

```bash
bun vitest src/server/routes/gomtm-configs/index.test.ts
```

Expected: PASS.

- [ ] **Step 3: Re-run the config UI tests in `/workspace/gomtmui`**

Run:

```bash
bun vitest src/components/gomtm-configs/config-list-view.test.tsx src/components/gomtm-configs/config-editor-view.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Re-run the repo typecheck in `/workspace/gomtmui`**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 5: If a commit is requested later, run GitNexus detect-changes before committing**

Required check before any future commit in `gomtmui`:

1. `gitnexus_detect_changes()`
2. Confirm the affected symbols are limited to the config-profile delete and list/detail interaction flow.

---

## Self-Review

### Spec coverage
- Remove redundant list `编辑` button: covered in Task 4.
- Make title the primary navigation entry: covered in Task 4.
- Add delete on list page: covered in Task 4.
- Add delete on detail page: covered in Task 5.
- Keep detail page as the edit page: preserved by Tasks 4 and 5; no separate read-only route is introduced.
- Add minimal backend support required for delete: covered by Tasks 1, 2, and 3.
- Use lightweight confirmation: covered in Tasks 4 and 5 with `window.confirm(...)`.
- Test-first execution: every implementation task starts with a failing test.

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every code-changing task names exact files and includes concrete code or commands.

### Type consistency
- DB layer uses `gomtm_config_profile_delete(p_name text) RETURNS boolean` consistently.
- Route layer calls RPC name `gomtm_config_profile_delete` consistently.
- Frontend API and UI both use `deleteConfigProfile(name)` consistently.
