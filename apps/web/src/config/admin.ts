/**
 * Admin Configuration
 */

// Admin wallet addresses that can access /admin
export const ADMIN_ADDRESSES = [
  "0x010030a0afc40b6d8fe99cee368cab5652baa0d36b7be60a9b017d5228c0bdfd",
];

export function isAdminAddress(address: string | undefined): boolean {
  if (!address) return false;
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}
