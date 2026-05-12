-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security — single-user app, but RLS is non-optional
-- ═══════════════════════════════════════════════════════════════════════════
-- Apply AFTER 0001 and 0002.
--
-- Model: every domain row is tied to one `users.id`, which is set equal to
-- the Supabase Auth UID at signup. Policies compare `auth.uid()` against
-- that id (directly or via the parent days row).
--
-- `idioms` is read-only-for-all-authenticated (it's a shared reference
-- table, not per-user data).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── enable RLS on every table ──────────────────────────────────────────────
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE days              ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatgpt_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE errors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE writings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE idioms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE silence_sessions  ENABLE ROW LEVEL SECURITY;

-- ── users ──────────────────────────────────────────────────────────────────
-- Read your own row; update your own row. No INSERT/DELETE from the client
-- (you seed it once manually with the service key).
CREATE POLICY users_select_self ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY users_update_self ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── days ───────────────────────────────────────────────────────────────────
CREATE POLICY days_owner_all ON days
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── errors ─────────────────────────────────────────────────────────────────
CREATE POLICY errors_owner_all ON errors
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── cards ──────────────────────────────────────────────────────────────────
CREATE POLICY cards_owner_all ON cards
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── chatgpt_reports (joined via days) ──────────────────────────────────────
CREATE POLICY chatgpt_reports_owner_all ON chatgpt_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = chatgpt_reports.day_id
              AND days.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = chatgpt_reports.day_id
              AND days.user_id = auth.uid())
  );

-- ── writings (joined via days) ─────────────────────────────────────────────
CREATE POLICY writings_owner_all ON writings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = writings.day_id
              AND days.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = writings.day_id
              AND days.user_id = auth.uid())
  );

-- ── recordings (joined via days) ───────────────────────────────────────────
CREATE POLICY recordings_owner_all ON recordings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = recordings.day_id
              AND days.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = recordings.day_id
              AND days.user_id = auth.uid())
  );

-- ── silence_sessions (joined via days) ─────────────────────────────────────
CREATE POLICY silence_sessions_owner_all ON silence_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = silence_sessions.day_id
              AND days.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM days
            WHERE days.id = silence_sessions.day_id
              AND days.user_id = auth.uid())
  );

-- ── idioms — read-only shared reference ────────────────────────────────────
CREATE POLICY idioms_read_all ON idioms
  FOR SELECT TO authenticated
  USING (true);

-- (writes to idioms go through the service key only — no policy = no access)
