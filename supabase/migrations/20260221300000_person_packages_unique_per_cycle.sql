-- One row per (person, package, service, start_date) so we never duplicate the same billing cycle.
-- Enables idempotent creation and cron; duplicate inserts become no-ops.
CREATE UNIQUE INDEX IF NOT EXISTS person_packages_person_package_service_start_key
  ON person_packages (person_id, package_id, service_id, start_date);
