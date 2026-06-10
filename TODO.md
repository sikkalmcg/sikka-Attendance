# TODO

- [ ] Speed up validation/login gateway to respond within ~3 seconds.
- [ ] Optimize `src/app/api/auth/login/route.ts`: reduce DB calls, remove broad `$or`, add targeted query paths based on input shape, and use parallel queries only if safe.
- [ ] (If applicable) check if root `route.ts` is used; if yes, simplify/disable heavy writes.
- [ ] Add/verify Mongo indexes needed for the new query patterns.
- [ ] Run `npm run build` (and any available tests) to ensure TypeScript/Next compilation passes.
- [ ] Measure endpoint latency for `/api/auth/login`.
