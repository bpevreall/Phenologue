-- Phenologue methodology v0.1 — session_draft (coach-mode foundation)
-- Stream D: parks incremental intake state for the conversational coach.
--
-- Lifecycle:
--   1. open       — POST /api/sessions/intake creates the row; draft_json
--                   holds whatever DraftState fields the client has supplied
--                   so far (possibly empty).
--   2. patches    — PATCH /api/sessions/intake/:id merges Partial<DraftState>
--                   into draft_json and bumps updated_at. Any number of
--                   patches may accumulate during the conversation.
--   3. commit     — POST /api/sessions/intake/:id/commit validates the
--                   accumulated draft_json against methodology rules, then
--                   inserts real rows into `session` + `rating` (matching the
--                   shape used by routes/session.ts:POST /). Sets committed_at
--                   and committed_session_id, linking the draft to the
--                   canonical session record.
--   4. void       — DELETE /api/sessions/intake/:id soft-deletes a draft
--                   (sets voided_at + void_reason). Drafts are NEVER hard-
--                   deleted; the audit-trail principle from §8 of the
--                   methodology applies.
--
-- The form-based flow in routes/session.ts:POST / is unchanged and continues
-- to bypass session_draft entirely. Only coach-mode and any future multi-
-- step intake flows park state here.
--
-- Cleanup: drafts older than 24h with no committed_at and no voided_at are
-- eligible for cleanup by a future cron job (NOT built in this migration —
-- the cleanup job is a separate deployment decision).

CREATE TABLE session_draft (
    id                    TEXT PRIMARY KEY,        -- nanoid(16)
    patient_id            TEXT NOT NULL,
    started_at            INTEGER NOT NULL,        -- ms epoch (draft creation)
    updated_at            INTEGER NOT NULL,        -- ms epoch (last patch / commit)
    draft_json            TEXT NOT NULL,           -- JSON-encoded partial DraftState
    committed_at          INTEGER,                 -- ms epoch when finalized
    committed_session_id  TEXT,                    -- FK to session.id once committed
    voided_at             INTEGER,                 -- soft-delete timestamp
    void_reason           TEXT,
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE,
    FOREIGN KEY (committed_session_id) REFERENCES session(id)
);

-- Partial index: list/lookup of "open" drafts (not yet committed, not voided)
-- for a patient. Used by the future cleanup cron and by any UI that resumes
-- an in-progress coach conversation.
CREATE INDEX idx_session_draft_patient_open
    ON session_draft (patient_id, started_at)
    WHERE committed_at IS NULL AND voided_at IS NULL;
