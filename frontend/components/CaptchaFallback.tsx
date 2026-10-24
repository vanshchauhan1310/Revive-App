import React, { useEffect } from 'react';
import { Platform } from 'react-native';

// This component handles CAPTCHA fallback for web
export const CaptchaFallback: React.FC = () => {
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Create a hidden div for CAPTCHA fallback
      const captchaDiv = document.createElement('div');
      captchaDiv.id = 'clerk-captcha';
      captchaDiv.style.display = 'none';
      document.body.appendChild(captchaDiv);

      // Cleanup on unmount
      return () => {
        const existingDiv = document.getElementById('clerk-captcha');
        if (existingDiv) {
          existingDiv.remove();
        }
      };
    }
  }, []);

  return null;
}; 