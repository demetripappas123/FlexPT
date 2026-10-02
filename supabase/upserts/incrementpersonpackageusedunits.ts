/**
 * Remaining session units are derived from sessions linked to person_package_id.
 * Completing a session that was already scheduled does not consume another unit.
 */
export async function incrementPersonPackageUsedUnits(_personPackageId: string): Promise<void> {
  return
}
