# Backend API Integration

The project has been aligned with the backend API specification supplied with this phase.

## Runtime

Set:

```env
EXPO_PUBLIC_API_MODE=http
EXPO_PUBLIC_API_URL=https://YOUR-BACKEND-DOMAIN
```

The app keeps the existing mock provider/order flows for endpoints that are not documented in the supplied backend specification. The documented authentication, wallet, and provider-service endpoints use the real backend when HTTP mode is enabled.

## Implemented backend routes

### Authentication
- `POST /api/auth/google/`
- `POST /api/auth/register/`
- `POST /api/auth/verify-email/`
- `POST /api/auth/resend-otp/`
- `POST /api/auth/login/`
- `POST /api/auth/token/refresh/`
- `POST /api/auth/password/forgot/`
- `POST /api/auth/password/reset/`
- `POST /api/auth/password/change/`
- `GET /api/auth/me/`
- `PATCH /api/auth/me/`

Access and refresh JWTs are stored separately in Expo SecureStore. Authenticated requests send `Authorization: Bearer <access>`.

Registration now follows the documented flow: register -> email OTP -> verify -> authenticated session.

### Wallet
- `GET /wallet/api/`
- `GET /wallet/api/transactions/`

The wallet summary and transaction ledger are loaded from the backend when HTTP mode is enabled. The backend remains authoritative for balance and financial operations.

### Provider services
- `POST /services/api/provider-services/`
- `GET /services/api/provider-services/mine/`

The "become provider" flow now sends the free-text service description, experience, and price range to the backend. The UI handles the documented clarification response and duplicate/AI-unavailable errors through the common API error shape.

## Important scope note

The supplied backend document does not define endpoints for orders, conversations, agreements, ratings, reports, blocks, or notifications. Those existing frontend flows therefore remain on the project's existing local/mock adapter until their backend API contract is supplied. No undocumented endpoint was invented.


## Google Login setup

The frontend now starts the Google OAuth browser flow, receives a Google `id_token`, and sends it to the documented `POST /api/auth/google/` endpoint. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` to the OAuth client ID configured for the app/backend. The existing `shobdk` Expo scheme is used for the native redirect. OAuth redirect URIs must be configured in Google Cloud to match the build/environment being used.

For native OAuth testing, use a development/standalone build rather than Expo Go; Expo documents that Expo Go cannot be used for local OAuth testing when the app needs a custom scheme.
