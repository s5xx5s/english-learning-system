-- ═══════════════════════════════════════════════════════════════════════════
-- Triggers — automatic behaviour layered on top of the schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Apply AFTER 0001_initial_schema.sql.
--
-- Trigger 1: generate_card_from_error
--   When an `errors` row reaches occurrence_count >= 3 and hasn't been
--   promoted yet, automatically create a corresponding `cards` row and
--   mark the error as promoted. This is the only path that creates
--   `personal_error` cards — never insert into cards manually for this
--   card_type.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_card_from_error()
RETURNS TRIGGER AS $$
DECLARE
  v_card_id UUID;
BEGIN
  IF NEW.occurrence_count >= 3 AND NEW.card_generated = FALSE THEN
    INSERT INTO cards (
      user_id, card_type, front, back, context_sentence,
      source_table, source_id, generated_from_error_count,
      weight_multiplier
    ) VALUES (
      NEW.user_id,
      'personal_error',
      NEW.wrong_form || ' ❌ → ' || NEW.correct_form || ' ✅',
      NEW.rule_violated,
      NEW.context_sentence,
      'errors',
      NEW.id,
      NEW.occurrence_count,
      1.5
    ) RETURNING id INTO v_card_id;

    NEW.card_id        := v_card_id;
    NEW.card_generated := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BEFORE UPDATE so we can mutate NEW.card_id / NEW.card_generated and have
-- them stored without a second write.
DROP TRIGGER IF EXISTS trg_error_to_card ON errors;
CREATE TRIGGER trg_error_to_card
  BEFORE UPDATE ON errors
  FOR EACH ROW
  EXECUTE FUNCTION generate_card_from_error();

-- ═══════════════════════════════════════════════════════════════════════════
-- Manual test (run in SQL Editor after 0003):
--
--   -- Insert an error at count 1
--   INSERT INTO errors (user_id, error_type, wrong_form, correct_form,
--                       rule_violated, source)
--   VALUES ((SELECT id FROM users LIMIT 1), 'grammar', 'He work',
--           'He works', '3rd person singular needs -s', 'claude_manual')
--   RETURNING id;
--
--   -- Bump to 3 → trigger should create a card and flip card_generated
--   UPDATE errors SET occurrence_count = 3
--   WHERE id = '<the-id-you-just-got>'
--   RETURNING card_generated, card_id;
--
--   -- Confirm a card was made
--   SELECT id, card_type, front, back FROM cards WHERE source_id = '<the-id>';
-- ═══════════════════════════════════════════════════════════════════════════
