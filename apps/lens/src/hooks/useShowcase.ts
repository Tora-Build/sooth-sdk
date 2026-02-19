import { createContext, useContext } from 'react';

/**
 * Context to indicate whether the app is rendered inside the desktop showcase (phone frame).
 * When true, components should use h-full instead of h-screen to fit the frame.
 */
export const ShowcaseContext = createContext(false);

export function useShowcase(): boolean {
  return useContext(ShowcaseContext);
}
