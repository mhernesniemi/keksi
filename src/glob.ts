/** `*` matches any run of characters, e.g. `ph_*_posthog`. */
export const glob = (pattern: string, name: string): boolean =>
  new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name);
