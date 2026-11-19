<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/rules

Sisenemispunkt: `packages/domain/src/rules/errors.ts`

### `RuleRejected`
```ts
export class RuleRejected extends Error {
    readonly reason: string;
    name: string;
    constructor(reason: string);
}
```

### `RuleTargetNotFound`
```ts
export class RuleTargetNotFound extends Error {
    readonly id: string;
    name: string;
    constructor(id: string);
}
```
