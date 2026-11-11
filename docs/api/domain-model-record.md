<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/record.ts`

### `stringRecord`
```ts
export function stringRecord<Value extends z.ZodType>(keys: z.ZodString, values: Value): z.ZodPreprocess<z.ZodRecord<z.ZodString, Value>, unknown>;
```
