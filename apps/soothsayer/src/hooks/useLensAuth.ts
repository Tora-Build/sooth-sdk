/**
 * Lens Authentication Hook
 * 
 * Placeholder — will implement SIWE flow when Lens V3 SDK is available.
 */

import { useState } from 'react';

export function useLensAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading] = useState(false);

  const login = async () => {
    // TODO: Implement Lens V3 SIWE auth
    console.warn('Lens auth not yet implemented — waiting for V3 SDK');
    setIsAuthenticated(false);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, login, logout };
}
