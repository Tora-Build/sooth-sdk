import content from '../config/ui-content.json';

// Type helper for nested keys
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: TObj[TKey] extends object
    ? `${TKey}` | `${TKey}.${RecursiveKeyOf<TObj[TKey]>}`
    : `${TKey}`;
}[keyof TObj & (string | number)];

type ContentType = typeof content;
export type ContentKey = RecursiveKeyOf<ContentType>;

/**
 * Access centralized UI content with type safety.
 * Supports simple variable interpolation: "Hello {{name}}"
 */
export const useContent = () => {
  const t = (key: ContentKey, vars?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = content;
    
    for (const k of keys) {
      value = value[k];
      if (value === undefined) {
        console.warn(`Missing content key: ${key}`);
        return key;
      }
    }
    
    if (typeof value !== 'string') {
        console.warn(`Content key returns object not string: ${key}`);
        return key;
    }

    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      });
    }

    return value;
  };

  return { t, content };
};
