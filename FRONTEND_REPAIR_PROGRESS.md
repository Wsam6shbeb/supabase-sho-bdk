# Frontend Repair Progress

## Phase 1 — completed
- Resolved the wallet TypeScript merge conflict.
- Normalized wallet transaction and verification types.
- Removed local Expo/build artifacts from the working archive.

## Phase 2 — completed
- Fixed tab navigation structure.
- Moved notifications out of the bottom tab bar.
- Removed duplicated Profile/Notifications screen implementations from the tab layer.
- Removed `as any` route casts from `src`.
- Added `src/services/api` as the frontend/backend boundary.
- Centralized business constants in `src/config/business.ts`.

## Phase 3 — completed
- Extracted frontend-only commission estimation from `OrderContext` into `src/domain/commission.ts`.
- Added explicit API boundary contracts in `src/services/api/contracts.ts`.
- Documented that real commission/agreement values are Backend-authoritative.
- Kept the existing mock adapter working so the UI can continue to run before Backend integration.

## Next
1. Split `OrderContext` into smaller domain hooks without changing the public `useOrder()` API.
2. Move request/conversation/agreement mutations behind API services.
3. Add a real API client implementation alongside the mock adapter.
4. Add loading/error/offline states around asynchronous data.
5. Add automated type/build checks once dependencies can be installed in the target environment.

## Phase 4 — Domain Context Decomposition
- Extracted notification state and actions into `src/hooks/order/useOrderNotifications.ts`.
- Extracted reports/blocking state and actions into `src/hooks/order/useOrderSafety.ts`.
- Kept the public `useOrder()` API stable for existing screens.
- Converted internal notification calls to a typed object payload to reduce positional-argument mistakes.
- Preserved the current mock behavior; these hooks are intentionally local until the Backend API becomes authoritative.
- Full dependency installation/build could not be completed in the execution environment because `npm ci` timed out; no claim of a clean TypeScript build is made.
