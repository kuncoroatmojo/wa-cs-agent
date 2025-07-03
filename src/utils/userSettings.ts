import type { Profile } from '../types';

/**
 * Get the WhatsApp target instance for a user
 * @param profile User profile
 * @returns The target instance or null if not set
 */
export function getUserTargetInstance(profile: Profile | null): string | null {
  return profile?.whatsapp_target_instance || null;
}

/**
 * Check if user has a target instance configured
 * @param profile User profile
 * @returns true if user has a target instance set
 */
export function hasTargetInstance(profile: Profile | null): boolean {
  return !!profile?.whatsapp_target_instance;
}

/**
 * Get fallback target instance (for backward compatibility)
 * This will be removed once all users have migrated to user-level settings
 */
export function getFallbackTargetInstance(): string {
  return (typeof import.meta !== 'undefined' && import.meta.env.VITE_WHATSAPP_TARGET_INSTANCE) || 
         (typeof process !== 'undefined' && process.env.VITE_WHATSAPP_TARGET_INSTANCE) || 
         'istn';
} 