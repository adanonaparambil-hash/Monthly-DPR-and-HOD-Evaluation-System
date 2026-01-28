/**
 * Avatar utility functions for handling default avatar images
 */
export class AvatarUtil {
  /**
   * Default avatar SVG path
   */
  static readonly DEFAULT_AVATAR = 'assets/images/default-avatar.svg';

  /**
   * Get avatar URL with fallback to default
   * @param avatarUrl - The avatar URL to check
   * @returns The avatar URL or default avatar if invalid
   */
  static getAvatarUrl(avatarUrl?: string | null): string {
    if (!avatarUrl || avatarUrl.trim() === '') {
      return this.DEFAULT_AVATAR;
    }

    // Check if it's the old Unsplash default image
    if (avatarUrl.includes('images.unsplash.com/photo-1472099645785-5658abf4ff4e')) {
      return this.DEFAULT_AVATAR;
    }

    return avatarUrl;
  }

  /**
   * Handle image error by setting default avatar
   * @param event - The error event
   * @param fallbackElement - The image element to update
   */
  static handleImageError(event: Event, fallbackElement?: HTMLImageElement): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.DEFAULT_AVATAR;
    }
    if (fallbackElement) {
      fallbackElement.src = this.DEFAULT_AVATAR;
    }
  }

  /**
   * Process profile image from API response
   * @param profileImageBase64 - Base64 image data from API
   * @param fallbackUrl - Optional fallback URL (will use default if not provided)
   * @returns Processed image URL
   */
  static processProfileImage(profileImageBase64?: string | null, fallbackUrl?: string): string {
    if (profileImageBase64 && profileImageBase64.trim() !== '') {
      // Handle base64 images
      if (profileImageBase64.startsWith('data:image/')) {
        return profileImageBase64;
      } else {
        return `data:image/jpeg;base64,${profileImageBase64}`;
      }
    }

    return this.getAvatarUrl(fallbackUrl);
  }
}