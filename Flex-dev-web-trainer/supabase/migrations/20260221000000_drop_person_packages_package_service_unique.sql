-- Allow many person_packages rows per (package_id, service_id):
-- one row per person per package per service per obligation cycle.
-- Drop the constraint that only allowed one row per package+service globally.

ALTER TABLE person_packages
  DROP CONSTRAINT IF EXISTS person_packages_package_id_service_id_key;

-- Optional: prevent duplicate cycles for the same person/package/service.
-- Uncomment if you want to enforce one row per (person, package, service, start_date).
-- ALTER TABLE person_packages
--   ADD CONSTRAINT person_packages_person_package_service_start_key
--   UNIQUE (person_id, package_id, service_id, start_date);
