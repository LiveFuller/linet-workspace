-- LINET Workspace — integrity tests (integrity_tests.sql)
-- Run after setup.sql as service_role / postgres (bypasses RLS) to verify hard constraints.
-- Checks uniqueness, CHECKs, FK integrity, and data-type correctness.
-- At least 12 checks; RAISE NOTICE on success/failure with final summary.

\set ON_ERROR_STOP on
DO $$
DECLARE
  ws_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  proj_a uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  proj_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  ws2 uuid;
  proj_dummy uuid;
  passed int := 0; failed int := 0; total int := 0;
  PROCEDURE ok(p_msg text) IS BEGIN total:=total+1; passed:=passed+1; RAISE NOTICE 'PASS %: %', total, p_msg; END;
  PROCEDURE fail(p_msg text) IS BEGIN total:=total+1; failed:=failed+1; RAISE NOTICE 'FAIL %: %', total, p_msg; END;
  PROCEDURE assert_true(p_cond boolean, p_msg text) IS BEGIN IF p_cond THEN PERFORM ok(p_msg); ELSE PERFORM fail(p_msg); END IF; END;
BEGIN
  RAISE NOTICE '=== LINET integrity tests ===';

  -- Ensure base data exists (rerun-safe)
  INSERT INTO public.workspaces (id,name,slug) VALUES (ws_id,'test_int_ws','test-int-ws') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id,email,display_name) VALUES ('11111111-1111-1111-1111-111111111111','int_owner@test.invalid','IntOwner') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.projects (id,workspace_id,name) VALUES (proj_a, ws_id,'ProjA-Int') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.projects (id,workspace_id,name) VALUES (proj_b, ws_id,'ProjB-Int') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.workstreams (id,project_id,workspace_id,name) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',proj_a,ws_id,'WS-Int-A') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.labels (id,project_id,workspace_id,name,color) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',proj_a,ws_id,'bug','#ff0000') ON CONFLICT (id) DO NOTHING;

  -- 1. membership unique per workspace (workspace_id,user_id)
  BEGIN
    INSERT INTO public.workspace_memberships (workspace_id,user_id,role) VALUES (ws_id,'11111111-1111-1111-1111-111111111111','member');
    INSERT INTO public.workspace_memberships (workspace_id,user_id,role) VALUES (ws_id,'11111111-1111-1111-1111-111111111111','viewer');
    PERFORM fail('1 membership uniqueness should have blocked duplicate');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('1 membership unique per workspace enforced');
    WHEN others THEN PERFORM fail('1 membership uniqueness wrong error: '||SQLERRM);
  END;
  DELETE FROM public.workspace_memberships WHERE workspace_id=ws_id AND user_id='11111111-1111-1111-1111-111111111111';

  -- 2. external provider mapping uniqueness with provider/container scope (NULL container handled via coalesce)
  BEGIN
    INSERT INTO public.external_links (provider,container_id,resource_id,workspace_id,task_id) VALUES ('planner','plan1','res1',ws_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
    -- second insert same provider+container+resource should fail
    INSERT INTO public.external_links (provider,container_id,resource_id,workspace_id,task_id) VALUES ('planner','plan1','res1',ws_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
    PERFORM fail('2 external mapping scoped uniqueness should block duplicate');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('2 external mapping uniqueness (provider/container/resource) enforced');
    WHEN others THEN PERFORM fail('2 external mapping unexpected: '||SQLERRM);
  END;
  DELETE FROM public.external_links WHERE provider='planner' AND resource_id='res1';

  -- 2b. NULL container_id treated same (coalesce)
  BEGIN
    INSERT INTO public.external_links (provider,container_id,resource_id,workspace_id,calendar_event_id) VALUES ('outlook',NULL,'ev1',ws_id, '00000000-0000-0000-0000-000000000001'::uuid);
    INSERT INTO public.external_links (provider,container_id,resource_id,workspace_id,calendar_event_id) VALUES ('outlook',NULL,'ev1',ws_id, '00000000-0000-0000-0000-000000000002'::uuid);
    PERFORM fail('2b external mapping NULL container dedupe should block');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('2b external mapping NULL container scope handled');
    WHEN others THEN PERFORM fail('2b unexpected: '||SQLERRM);
  END;
  DELETE FROM public.external_links WHERE provider='outlook' AND resource_id='ev1';

  -- 3. notification dedupe (person_id,dedupe_key) unique
  INSERT INTO public.profiles (id,email) VALUES ('22222222-2222-2222-2222-222222222222','notif@test.invalid') ON CONFLICT (id) DO NOTHING;
  BEGIN
    INSERT INTO public.notifications (person_id,kind,title,destination,dedupe_key) VALUES ('22222222-2222-2222-2222-222222222222','system','t1','/inbox','dedupe-xyz');
    INSERT INTO public.notifications (person_id,kind,title,destination,dedupe_key) VALUES ('22222222-2222-2222-2222-222222222222','system','t1 dup','/inbox','dedupe-xyz');
    PERFORM fail('3 notification dedupe should block duplicate dedupe_key per person');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('3 notification dedupe key enforced');
    WHEN others THEN PERFORM fail('3 unexpected: '||SQLERRM);
  END;
  DELETE FROM public.notifications WHERE person_id='22222222-2222-2222-2222-222222222222' AND dedupe_key='dedupe-xyz';

  -- 4. checklist ordering nonnegative (position >=0)
  BEGIN
    INSERT INTO public.tasks (id,project_id,workspace_id,title) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0',proj_a,ws_id,'chk task') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.task_checklist_items (task_id,title,position) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0','item',-1);
    PERFORM fail('4 checklist position nonnegative should block -1');
  EXCEPTION WHEN check_violation THEN PERFORM ok('4 checklist ordering nonnegative enforced');
    WHEN others THEN PERFORM fail('4 unexpected: '||SQLERRM);
  END;
  DELETE FROM public.task_checklist_items WHERE task_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0';
  DELETE FROM public.tasks WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0';

  -- 5. due date as date not timestamptz misuse (column type is date)
  PERFORM assert_true(
    (SELECT data_type='date' FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='due_date'),
    '5 due_date column is type date (not timestamptz)'
  );
  BEGIN
    INSERT INTO public.tasks (id,project_id,workspace_id,title,due_date) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',proj_a,ws_id,'date task','2026-09-08');
    PERFORM ok('5b due_date accepts date literal');
    DELETE FROM public.tasks WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  EXCEPTION WHEN others THEN PERFORM fail('5b due_date insert failed: '||SQLERRM);
  END;

  -- 6. exactly-one-parent on attachments (num_nonnulls =1)
  BEGIN
    INSERT INTO public.tasks (id,project_id,workspace_id,title) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',proj_a,ws_id,'att parent') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.documents (id,project_id,workspace_id,title,category,owner_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',proj_a,ws_id,'doc','reference','11111111-1111-1111-1111-111111111111') ON CONFLICT (id) DO NOTHING;
    -- try zero parents
    INSERT INTO public.attachments (project_id,workspace_id,file_name,file_size,mime_type,storage_path,uploaded_by) VALUES (proj_a,ws_id,'f.pdf',100,'application/pdf','ws/proj/f.pdf','11111111-1111-1111-1111-111111111111');
    PERFORM fail('6 attachments exactly-one-parent should block zero parents');
  EXCEPTION WHEN check_violation THEN PERFORM ok('6 attachments exactly-one-parent (zero) enforced');
    WHEN others THEN PERFORM fail('6 unexpected zero: '||SQLERRM);
  END;
  BEGIN
    INSERT INTO public.attachments (project_id,workspace_id,file_name,file_size,mime_type,storage_path,uploaded_by,task_id,document_id) VALUES (proj_a,ws_id,'g.pdf',100,'application/pdf','ws/proj/g.pdf','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3');
    PERFORM fail('6b attachments exactly-one-parent should block two parents');
  EXCEPTION WHEN check_violation THEN PERFORM ok('6b attachments exactly-one-parent (two) enforced');
    WHEN others THEN PERFORM fail('6b unexpected two: '||SQLERRM);
  END;
  DELETE FROM public.attachments WHERE storage_path IN ('ws/proj/f.pdf','ws/proj/g.pdf');
  DELETE FROM public.documents WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  DELETE FROM public.tasks WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';

  -- 7. scheduled job dedupe key (integration_jobs workspace_id,execution_key unique)
  BEGIN
    INSERT INTO public.integrations (id,workspace_id,state) VALUES ('supabase',ws_id,'not_configured') ON CONFLICT (workspace_id,id) DO NOTHING;
    INSERT INTO public.integration_jobs (workspace_id,integration_id,execution_key,job_type) VALUES (ws_id,'supabase','key-123','sync');
    INSERT INTO public.integration_jobs (workspace_id,integration_id,execution_key,job_type) VALUES (ws_id,'supabase','key-123','sync');
    PERFORM fail('7 integration_jobs execution_key unique should block duplicate');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('7 scheduled job dedupe key enforced');
    WHEN others THEN PERFORM fail('7 unexpected: '||SQLERRM);
  END;
  DELETE FROM public.integration_jobs WHERE workspace_id=ws_id AND execution_key='key-123';

  -- 7b. report_schedules unique per project/kind/timezone/sendAtLocal/channel when enabled
  BEGIN
    INSERT INTO public.report_schedules (project_id,workspace_id,kind,cadence,timezone,send_at_local,channel) VALUES (proj_a,ws_id,'daily','daily','Pacific/Port_Moresby','08:00','in_app');
    INSERT INTO public.report_schedules (project_id,workspace_id,kind,cadence,timezone,send_at_local,channel) VALUES (proj_a,ws_id,'daily','daily','Pacific/Port_Moresby','08:00','in_app');
    PERFORM fail('7b report schedule dedupe should block duplicate enabled schedule');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('7b report schedule execution key enforced');
    WHEN others THEN PERFORM fail('7b unexpected: '||SQLERRM);
  END;
  DELETE FROM public.report_schedules WHERE project_id=proj_a AND kind='daily' AND send_at_local='08:00';

  -- 8. task label uniqueness (task_id,label_id) PK
  BEGIN
    INSERT INTO public.tasks (id,project_id,workspace_id,title) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',proj_a,ws_id,'label task') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.task_labels (task_id,label_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    INSERT INTO public.task_labels (task_id,label_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    PERFORM fail('8 task label uniqueness should block duplicate');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('8 task label uniqueness enforced');
    WHEN others THEN PERFORM fail('8 unexpected: '||SQLERRM);
  END;
  DELETE FROM public.task_labels WHERE task_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4';
  DELETE FROM public.tasks WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4';

  -- 9. processed source action uniqueness (meeting_id,source_action_key)
  BEGIN
    INSERT INTO public.meetings (id,project_id,workspace_id,title,starts_at,duration_min) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',proj_a,ws_id,'m','2026-09-08 10:00+10',30) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.meeting_action_proposals (meeting_id,source_action_key,evidence_text,proposed_title,extraction_method) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5','key-1','evidence','title','manual');
    INSERT INTO public.meeting_action_proposals (meeting_id,source_action_key,evidence_text,proposed_title,extraction_method) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5','key-1','evidence2','title2','manual');
    PERFORM fail('9 meeting_action_proposals uniqueness should block duplicate source_action_key per meeting');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('9 processed source action uniqueness enforced');
    WHEN others THEN PERFORM fail('9 unexpected: '||SQLERRM);
  END;
  DELETE FROM public.meeting_action_proposals WHERE meeting_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5';
  DELETE FROM public.meetings WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5';

  -- 10. activity_events append-only (no update/delete via trigger)
  BEGIN
    INSERT INTO public.activity_events (project_id,workspace_id,kind,summary) VALUES (proj_a,ws_id,'task.created','test') RETURNING id INTO ws2;
    UPDATE public.activity_events SET summary='hacked' WHERE id=ws2;
    PERFORM fail('10 activity_events should be append-only (update blocked)');
  EXCEPTION WHEN others THEN PERFORM ok('10 activity append check enforced');
  END;
  DELETE FROM public.activity_events WHERE id=ws2;

  -- 11. IANA timezone column exists and is not empty for calendar_events
  PERFORM assert_true(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='calendar_events' AND column_name='timezone'),
    '11 calendar_events has IANA timezone column'
  );
  BEGIN
    INSERT INTO public.calendar_events (project_id,workspace_id,title,date_mode,start_at,timezone) VALUES (proj_a,ws_id,'ev','timed',now(),'Pacific/Port_Moresby');
    PERFORM ok('11b calendar_events accepts IANA timezone');
    DELETE FROM public.calendar_events WHERE title='ev';
  EXCEPTION WHEN others THEN PERFORM fail('11b timezone insert failed: '||SQLERRM);
  END;

  -- 12. same-workspace FK integrity via composite FK or trigger (task workspace must match project)
  BEGIN
    INSERT INTO public.tasks (project_id,workspace_id,title) VALUES (proj_a, '00000000-0000-0000-0000-000000000099'::uuid, 'bad ws');
    PERFORM fail('12 same-workspace integrity should block mismatched workspace_id');
  EXCEPTION WHEN foreign_key_violation THEN PERFORM ok('12 same-workspace FK integrity enforced (FK)');
    WHEN others THEN
      -- trigger raises generic exception with message containing workspace_id
      IF SQLERRM LIKE '%workspace_id must match%' THEN PERFORM ok('12 same-workspace integrity enforced (trigger)');
      ELSE PERFORM fail('12 unexpected error: '||SQLERRM);
      END IF;
  END;

  -- 13. inbox_items fingerprint unique per project
  BEGIN
    INSERT INTO public.inbox_items (project_id,workspace_id,kind,captured_by,title,fingerprint) VALUES (proj_a,ws_id,'note','11111111-1111-1111-1111-111111111111','t1','fp-123');
    INSERT INTO public.inbox_items (project_id,workspace_id,kind,captured_by,title,fingerprint) VALUES (proj_a,ws_id,'note','11111111-1111-1111-1111-111111111111','t2','fp-123');
    PERFORM fail('13 inbox fingerprint unique should block duplicate per project');
  EXCEPTION WHEN unique_violation THEN PERFORM ok('13 inbox fingerprint uniqueness enforced');
    WHEN others THEN PERFORM fail('13 unexpected: '||SQLERRM);
  END;
  DELETE FROM public.inbox_items WHERE fingerprint='fp-123';

  RAISE NOTICE '=== Integrity tests summary: % passed, % failed, % total ===', passed, failed, total;
  IF failed>0 THEN RAISE EXCEPTION 'Integrity tests failed: % of %', failed, total; END IF;
END $$;
