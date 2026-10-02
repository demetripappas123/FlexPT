-- Sessions consume person_packages entitlements.
-- Remaining units = units_per_obligation_cycle minus consuming sessions
-- (any status except canceled_no_charge). No used_units column: the
-- session list is the source of truth so people can schedule at will.

UPDATE sessions
SET person_package_id = NULL
WHERE person_package_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM person_packages pp
    WHERE pp.id = sessions.person_package_id
  );

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_person_package_id_fkey;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_person_package_id_fkey
  FOREIGN KEY (person_package_id)
  REFERENCES person_packages(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_person_package_id_idx
  ON sessions (person_package_id)
  WHERE person_package_id IS NOT NULL;

COMMENT ON COLUMN sessions.person_package_id IS
  'Entitlement this session consumes. Remaining units are derived from linked sessions.';
