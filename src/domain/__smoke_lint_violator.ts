// Intentional lint violation for CI smoke test (T9.7).
// This file MUST cause `npm run lint` to fail.
// Will be reverted; PR is closed without merge.
let unused_let_should_be_const = 1;
const explicitAny: any = unused_let_should_be_const;
export const result = explicitAny;
