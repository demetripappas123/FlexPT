-- When a package is deleted, delete all person_packages rows that reference it.

-- Drop existing FK on person_packages.package_id if present (may not have CASCADE)
ALTER TABLE person_packages
  DROP CONSTRAINT IF EXISTS person_packages_package_id_fkey;

-- Re-add FK with ON DELETE CASCADE so deleting a package deletes its person_packages rows
ALTER TABLE person_packages
  ADD CONSTRAINT person_packages_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE;
