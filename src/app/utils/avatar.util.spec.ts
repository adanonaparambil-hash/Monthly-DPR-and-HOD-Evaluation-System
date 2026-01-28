import { AvatarUtil } from './avatar.util';

describe('AvatarUtil', () => {
  describe('getAvatarUrl', () => {
    it('should return default avatar for null or empty input', () => {
      expect(AvatarUtil.getAvatarUrl(null)).toBe(AvatarUtil.DEFAULT_AVATAR);
      expect(AvatarUtil.getAvatarUrl('')).toBe(AvatarUtil.DEFAULT_AVATAR);
      expect(AvatarUtil.getAvatarUrl('   ')).toBe(AvatarUtil.DEFAULT_AVATAR);
    });

    it('should return default avatar for old Unsplash URL', () => {
      const oldUrl = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format';
      expect(AvatarUtil.getAvatarUrl(oldUrl)).toBe(AvatarUtil.DEFAULT_AVATAR);
    });

    it('should return the same URL for valid URLs', () => {
      const validUrl = 'https://example.com/avatar.jpg';
      expect(AvatarUtil.getAvatarUrl(validUrl)).toBe(validUrl);
    });
  });

  describe('processProfileImage', () => {
    it('should return default avatar for null or empty base64', () => {
      expect(AvatarUtil.processProfileImage(null)).toBe(AvatarUtil.DEFAULT_AVATAR);
      expect(AvatarUtil.processProfileImage('')).toBe(AvatarUtil.DEFAULT_AVATAR);
    });

    it('should return data URL for base64 without prefix', () => {
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const result = AvatarUtil.processProfileImage(base64);
      expect(result).toBe(`data:image/jpeg;base64,${base64}`);
    });

    it('should return the same URL for data URLs with prefix', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      expect(AvatarUtil.processProfileImage(dataUrl)).toBe(dataUrl);
    });

    it('should use fallback URL when provided and no base64', () => {
      const fallbackUrl = 'https://example.com/fallback.jpg';
      expect(AvatarUtil.processProfileImage(null, fallbackUrl)).toBe(fallbackUrl);
    });
  });

  describe('handleImageError', () => {
    it('should set default avatar on image error', () => {
      const mockImg = document.createElement('img');
      const mockEvent = { target: mockImg } as Event;
      
      AvatarUtil.handleImageError(mockEvent);
      
      expect(mockImg.src).toContain('default-avatar.svg');
    });
  });
});