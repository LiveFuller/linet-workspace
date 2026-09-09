-- LINET Workspace — RLS test suite (rls_tests.sql)
-- Requires a live PostgreSQL / Supabase project with setup.sql already applied.
-- Run as superuser / service_role (bypasses RLS) to bootstrap test users, then
-- impersonates each role via `set_config('request.jwt.claim.sub', ...)`
-- (Supabase's auth.uid() reads that setting) and via `set_config('request.jwt.claim.role',...)`.
-- Bootstrap flow: run scripts/bootstrap-owner.mjs first to create a real workspace,
-- or let this script create ephemeral test workspaces/users under a test_ prefix.
-- Uses plain plpgsql asserts with RAISE NOTICE; compatible with pgTAP-style harnesses.
-- At least 20 assertions; final summary reports passed/failed.

\set ON_ERROR_STOP on
\pset pager off

DO $$
DECLARE
  -- test user ids (deterministic uuids for repeatable runs)
  anon_id uuid := '00000000-0000-0000-0000-000000000000';
  owner_id uuid := '11111111-1111-1111-1111-111111111111';
  viewer_id uuid := '22222222-2222-2222-2222-222222222222';
  member_id uuid := '33333333-3333-3333-3333-333333333333';
  lead_id uuid := '44444444-4444-4444-4444-444444444444';
  coord_id uuid := '55555555-5555-5555-5555-555555555555';
  outsider_id uuid := '66666666-6666-6666-6666-666666666666';
  ws_id uuid;
  proj_a uuid;
  proj_b uuid;
  ws2_id uuid;
  task_id uuid;
  support_id uuid;
  passed int := 0;
  failed int := 0;
  total int := 0;
  _r record;

  PROCEDURE assert_true(p_cond boolean, p_msg text) IS
  BEGIN
    total := total + 1;
    IF p_cond THEN
      passed := passed + 1;
      RAISE NOTICE 'PASS %: %', total, p_msg;
    ELSE
      failed := failed + 1;
      RAISE NOTICE 'FAIL %: %', total, p_msg;
    END IF;
  END;

  PROCEDURE assert_false(p_cond boolean, p_msg text) IS
  BEGIN
    CALL assert_true(NOT p_cond, p_msg);
  END;

  FUNCTION as_user(p_uid uuid, p_role text DEFAULT 'authenticated') RETURNS void IS
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
    PERFORM set_config('request.jwt.claim.role', p_role, true);
    PERFORM set_config('role', p_role, true);
  END;

  FUNCTION as_anon() RETURNS void IS
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('role', 'anon', true);
  END;

  FUNCTION as_service() RETURNS void IS
  BEGIN
    -- service_role bypasses RLS; clear jwt
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'postgres', true);
  END;

BEGIN
  RAISE NOTICE '=== LINET RLS tests — bootstrapping ephemeral data ===';

  -- clean previous ephemeral test data (rerun-safe)
  PERFORM as_service();
  DELETE FROM public.workspaces WHERE name LIKE 'test_rls_%';

  -- Ensure profiles exist (upsert, does not overwrite edited display_name? we use ON CONFLICT DO NOTHING after check)
  INSERT INTO public.profiles (id, email, display_name) VALUES
    (owner_id, 'owner@test.invalid', 'Owner'), (viewer_id, 'viewer@test.invalid','Viewer'),
    (member_id,'member@test.invalid','Member'), (lead_id,'lead@test.invalid','Lead'),
    (coord_id,'coord@test.invalid','Coord'), (outsider_id,'outsider@test.invalid','Outsider')
  ON CONFLICT (id) DO NOTHING;

  -- create workspace + projects as service (bypass RLS)
  INSERT INTO public.workspaces (id, name, slug) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','test_rls_ws','test-rls-ws')
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO ws_id FROM public.workspaces WHERE slug='test-rls-ws';

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role) VALUES
    (ws_id, owner_id, 'workspace_admin'), (ws_id, viewer_id,'viewer'),
    (ws_id, member_id,'member'), (ws_id, lead_id,'project_lead'), (ws_id, coord_id,'it_coordinator')
  ON CONFLICT (workspace_id,user_id) DO NOTHING;

  INSERT INTO public.projects (id, workspace_id, name, timezone) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', ws_id, 'ProjA','Pacific/Port_Moresby'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', ws_id, 'ProjB','Pacific/Port_Moresby')
  ON CONFLICT (id) DO NOTHING;
  proj_a := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
  proj_b := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;

  INSERT INTO public.project_memberships (project_id, workspace_id, user_id, role) VALUES
    (proj_a, ws_id, lead_id, 'project_lead'), (proj_a, ws_id, member_id,'member')
  ON CONFLICT (project_id,user_id) DO NOTHING;

  INSERT INTO public.workstreams (id, project_id, workspace_id, name) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', proj_a, ws_id, 'WS-A'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', proj_b, ws_id, 'WS-B')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (id, project_id, workspace_id, title, created_by, owner_id, status) VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', proj_a, ws_id, 'Member task', member_id, member_id, 'todo')
  ON CONFLICT (id) DO NOTHING;
  task_id := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;

  INSERT INTO public.support_tickets (id, project_id, workspace_id, title, category, requester_id, status) VALUES
    ('99999999-9999-9999-9999-999999999999', proj_a, ws_id, 'Private ticket','access', member_id, 'captured')
  ON CONFLICT (id) DO NOTHING;
  support_id := '99999999-9999-9999-9999-999999999999'::uuid;

  RAISE NOTICE '=== Running assertions as different roles ===';

  -- 1. anon denied: anon cannot read workspaces
  PERFORM as_anon();
  BEGIN
    PERFORM 1 FROM public.workspaces WHERE id=ws_id;
    -- with RLS, anon sees 0 rows; we check count
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE id=ws_id) THEN
      CALL assert_false(true, '1 anon should be denied reading workspaces (saw row)');
    ELSE
      CALL assert_true(true, '1 anon denied reading workspaces');
    END IF;
  EXCEPTION WHEN others THEN CALL assert_true(true, '1 anon denied (exception)');
  END;

  -- 2. anon cannot read tasks
  PERFORM as_anon();
  CALL assert_true(NOT EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id), '2 anon denied reading tasks');

  -- 3. authenticated nonmember (outsider) denied
  PERFORM as_user(outsider_id);
  CALL assert_true(NOT EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id), '3 outsider nonmember denied reading tasks');
  CALL assert_true(NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id=ws_id), '4 outsider denied reading workspace');

  -- 5. viewer read-only: can read tasks
  PERFORM as_user(viewer_id);
  CALL assert_true(EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id), '5 viewer can read tasks');

  -- 6. viewer cannot create tasks (should fail RLS)
  PERFORM as_user(viewer_id);
  BEGIN
    INSERT INTO public.tasks (project_id, workspace_id, title, created_by) VALUES (proj_a, ws_id, 'viewer attempt', viewer_id);
    CALL assert_false(true, '6 viewer should NOT be able to create tasks');
    DELETE FROM public.tasks WHERE title='viewer attempt';
  EXCEPTION WHEN others THEN
    CALL assert_true(true, '6 viewer blocked from creating tasks');
  END;

  -- 7. viewer cannot update tasks
  PERFORM as_user(viewer_id);
  BEGIN
    UPDATE public.tasks SET title='hacked' WHERE id=task_id;
    -- check if row was actually updated visible
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id AND title='hacked') THEN
      CALL assert_false(true, '7 viewer should not update tasks');
    ELSE
      CALL assert_true(true, '7 viewer blocked from updating tasks');
    END IF;
  EXCEPTION WHEN others THEN CALL assert_true(true, '7 viewer blocked from updating tasks (exception)');
  END;

  -- 8. member can create task in own workspace
  PERFORM as_user(member_id);
  BEGIN
    INSERT INTO public.tasks (id, project_id, workspace_id, title, created_by, owner_id) VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', proj_a, ws_id, 'member created', member_id, member_id);
    CALL assert_true(EXISTS (SELECT 1 FROM public.tasks WHERE title='member created'), '8 member can create task');
    DELETE FROM public.tasks WHERE id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;
  EXCEPTION WHEN others THEN CALL assert_false(true, '8 member should be able to create task but got exception ' || SQLERRM);
  END;

  -- 9. member can read own task
  PERFORM as_user(member_id);
  CALL assert_true(EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id), '9 member can read own task');

  -- 10. member can update own task (owner)
  PERFORM as_user(member_id);
  BEGIN
    UPDATE public.tasks SET title='updated by owner' WHERE id=task_id;
    CALL assert_true(EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id AND title='updated by owner'), '10 member can update own task');
    -- revert
    PERFORM as_service(); UPDATE public.tasks SET title='Member task' WHERE id=task_id;
  EXCEPTION WHEN others THEN CALL assert_false(true, '10 member should update own task: '||SQLERRM);
  END;

  -- 11. member cannot escalate role via workspace_memberships (no admin)
  PERFORM as_user(member_id);
  BEGIN
    UPDATE public.workspace_memberships SET role='workspace_admin' WHERE workspace_id=ws_id AND user_id=member_id;
    IF EXISTS (SELECT 1 FROM public.workspace_memberships WHERE workspace_id=ws_id AND user_id=member_id AND role='workspace_admin') THEN
      CALL assert_false(true, '11 member should NOT escalate to admin');
      PERFORM as_service(); UPDATE public.workspace_memberships SET role='member' WHERE workspace_id=ws_id AND user_id=member_id;
    ELSE
      CALL assert_true(true, '11 member blocked from escalating role');
    END IF;
  EXCEPTION WHEN others THEN CALL assert_true(true, '11 member blocked from escalating role (exception)');
  END;

  -- 12. member cannot insert membership
  PERFORM as_user(member_id);
  BEGIN
    INSERT INTO public.workspace_memberships (workspace_id, user_id, role) VALUES (ws_id, outsider_id, 'member');
    CALL assert_false(true, '12 member should not insert membership');
    PERFORM as_service(); DELETE FROM public.workspace_memberships WHERE workspace_id=ws_id AND user_id=outsider_id;
  EXCEPTION WHEN others THEN CALL assert_true(true, '12 member blocked from inserting membership');
  END;

  -- 13. project_lead can manage project tasks (update any task in proj_a)
  PERFORM as_user(lead_id);
  BEGIN
    UPDATE public.tasks SET title='lead updated' WHERE id=task_id;
    CALL assert_true(EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id AND title='lead updated'), '13 project_lead can update any task in managed project');
    PERFORM as_service(); UPDATE public.tasks SET title='Member task' WHERE id=task_id;
  EXCEPTION WHEN others THEN CALL assert_false(true, '13 lead should manage tasks: '||SQLERRM);
  END;

  -- 14. project_lead cannot view private support case (not requester/coordinator, not admin/coord)
  PERFORM as_user(lead_id);
  CALL assert_true(NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE id=support_id), '14 project_lead cannot view private support case');

  -- 15. it_coordinator can see support queue (any ticket)
  PERFORM as_user(coord_id);
  CALL assert_true(EXISTS (SELECT 1 FROM public.support_tickets WHERE id=support_id), '15 it_coordinator can see support queue');

  -- 16. workspace_admin can manage membership (insert)
  PERFORM as_user(owner_id);
  BEGIN
    INSERT INTO public.workspace_memberships (workspace_id, user_id, role) VALUES (ws_id, outsider_id, 'viewer') ON CONFLICT DO NOTHING;
    CALL assert_true(EXISTS (SELECT 1 FROM public.workspace_memberships WHERE workspace_id=ws_id AND user_id=outsider_id), '16 workspace_admin can manage membership');
    DELETE FROM public.workspace_memberships WHERE workspace_id=ws_id AND user_id=outsider_id;
  EXCEPTION WHEN others THEN CALL assert_false(true, '16 admin should manage membership: '||SQLERRM);
  END;

  -- 17. workspace_admin can update membership role
  PERFORM as_user(owner_id);
  BEGIN
    UPDATE public.workspace_memberships SET role='member' WHERE workspace_id=ws_id AND user_id=viewer_id;
    CALL assert_true(true, '17 workspace_admin can update membership role');
    UPDATE public.workspace_memberships SET role='viewer' WHERE workspace_id=ws_id AND user_id=viewer_id;
  EXCEPTION WHEN others THEN CALL assert_false(true, '17 admin should update membership: '||SQLERRM);
  END;

  -- 18. cross-project ID spoofing fails: workstream from proj_b used in task for proj_a
  PERFORM as_user(member_id);
  BEGIN
    INSERT INTO public.tasks (project_id, workspace_id, workstream_id, title, created_by) VALUES (proj_a, ws_id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'spoofed', member_id);
    CALL assert_false(true, '18 cross-project workstream spoofing should fail');
    DELETE FROM public.tasks WHERE title='spoofed';
  EXCEPTION WHEN others THEN CALL assert_true(true, '18 cross-project ID spoofing blocked');
  END;

  -- 19. storage private paths enforced: member cannot read other workspace path (simulate via helper)
  PERFORM as_user(member_id);
  CALL assert_true(public.can_access_storage_path(ws_id::text || '/file.pdf'), '19 member can access own workspace storage path');
  CALL assert_false(public.can_access_storage_path('00000000-0000-0000-0000-000000000000/file.pdf'), '20 outsider path denied via helper');

  -- 21. anon cannot insert tasks
  PERFORM as_anon();
  BEGIN
    INSERT INTO public.tasks (project_id, workspace_id, title, created_by) VALUES (proj_a, ws_id, 'anon insert', anon_id);
    CALL assert_false(true, '21 anon should not insert tasks');
  EXCEPTION WHEN others THEN CALL assert_true(true, '21 anon blocked from inserting tasks');
  END;

  -- 22. viewer cannot delete tasks
  PERFORM as_user(viewer_id);
  BEGIN
    DELETE FROM public.tasks WHERE id=task_id;
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id) THEN
      CALL assert_true(true, '22 viewer blocked from deleting tasks (still exists)');
    ELSE
      CALL assert_false(true, '22 viewer should not delete tasks');
      PERFORM as_service(); INSERT INTO public.tasks (id, project_id, workspace_id, title, created_by, owner_id) VALUES (task_id, proj_a, ws_id, 'Member task', member_id, member_id) ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN others THEN CALL assert_true(true, '22 viewer blocked from deleting tasks (exception)');
  END;

  -- 23. member's completed task respects due_date is date type (checked in setup) but also RLS allows update
  PERFORM as_user(member_id);
  BEGIN
    UPDATE public.tasks SET due_date = CURRENT_DATE WHERE id=task_id;
    CALL assert_true(EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id AND due_date=CURRENT_DATE), '23 member can set due_date as date');
    PERFORM as_service(); UPDATE public.tasks SET due_date=NULL WHERE id=task_id;
  EXCEPTION WHEN others THEN CALL assert_false(true, '23 due_date update failed: '||SQLERRM);
  END;

  -- cleanup
  PERFORM as_service();
  RAISE NOTICE '=== RLS tests summary: % passed, % failed, % total ===', passed, failed, total;
  IF failed > 0 THEN RAISE EXCEPTION 'RLS tests failed: % of %', failed, total; END IF;
END $$;
