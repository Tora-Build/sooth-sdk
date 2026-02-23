import { useContext, useCallback } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { ShowcaseContext } from './useShowcase';
import { PhoneRouteContext } from '../App';

/**
 * Showcase-aware navigation hook.
 *
 * In showcase mode (desktop phone simulator), navigation uses PhoneRouteContext
 * (state-based routing) instead of react-router, which would change the real
 * browser URL.
 *
 * In mobile mode, delegates to react-router's navigate().
 */
export function usePhoneNavigate() {
  const inShowcase = useContext(ShowcaseContext);
  const phoneRoute = useContext(PhoneRouteContext);
  const navigate = useNavigate();

  const phoneNavigate = useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        // Back navigation: in showcase, go to home; in mobile, use history
        if (inShowcase) {
          phoneRoute.setRoute('/');
        } else {
          navigate(to);
        }
        return;
      }

      if (inShowcase) {
        phoneRoute.setRoute(to);
      } else {
        navigate(to, options);
      }
    },
    [inShowcase, phoneRoute, navigate],
  );

  return phoneNavigate;
}
