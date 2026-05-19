-- contracts.package_id should reference packages(id), not person_packages.
-- Drop the wrong FK (if it was created pointing at person_packages) and add the correct one.

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_package_id_fkey;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES packages(id);
