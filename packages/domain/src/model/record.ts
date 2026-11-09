import { z } from 'zod';

export function stringRecord<Value extends z.ZodType>(keys: z.ZodString, values: Value) {
  // Zod skips this own key before checking record entries. Reject it before parsing to avoid data loss.
  return z.preprocess(
    (input, context) => {
      if (input !== null && typeof input === 'object' && Object.hasOwn(input, '__proto__')) {
        context.addIssue({ code: 'custom', path: ['__proto__'], message: 'Unsupported map key' });
        return z.NEVER;
      }
      return input;
    },
    z.record(keys, values),
  );
}
