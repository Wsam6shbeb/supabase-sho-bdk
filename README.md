# Sho Bdk — Service Marketplace

**Sho Bdk** is a full-stack mobile marketplace that connects customers with local service providers. The platform brings service discovery, AI-assisted request analysis, provider matching, order management, and customer–provider communication into one application.

[**View the Android application (APK)**](https://sho-bdk-download.vercel.app)

---

## Project at a glance

| Area | Technology |
|---|---|
| Mobile application | React Native |
| Framework & navigation | Expo SDK 57, Expo Router |
| Language | TypeScript |
| Backend platform | Supabase |
| Data layer | PostgreSQL |
| Server-side operations | Supabase Edge Functions |
| Authentication & data access | Supabase Auth, supabase-js |
| AI integration | Google Gemini |
| Error monitoring | Sentry |

## Core capabilities

- **Service discovery and requests** — customers can describe the service they need and submit a request.
- **AI-assisted request analysis** — service requests are analyzed to help identify relevant service categories and matching providers.
- **Provider matching** — candidate providers are retrieved and narrowed using backend matching logic.
- **Provider profiles** — service providers can describe the services they offer and manage their service information.
- **Order lifecycle** — supports the flow between customer requests, provider responses, and order management.
- **Messaging** — customer and provider communication within the application.
- **Provider verification workflow** — supports submission and administrative review of provider verification information.
- **Wallet and commissions** — includes provider balance and service commission concepts.
- **Administrative dashboard** — a companion dashboard supports operational and verification workflows.

## Architecture

The application is built around a React Native client and a Supabase backend.

```text
React Native / Expo
        |
        | Supabase client
        v
Supabase
  |-- PostgreSQL database
  |-- Authentication
  |-- Row Level Security (RLS)
  |-- Edge Functions
        |
        | AI-assisted analysis
        v
   Google Gemini
```

The mobile client handles the user experience, while database access and selected server-side workflows are handled through Supabase. Edge Functions are used for backend operations such as service analysis and provider matching.

## Engineering highlights

- **Typed mobile codebase:** TypeScript is used across the application.
- **File-based navigation:** Expo Router organizes application routes.
- **Backend-driven workflows:** Supabase Edge Functions handle selected operations that should not be implemented as client-only logic.
- **Database access control:** Supabase Row Level Security is part of the backend access-control model.
- **AI integration:** Gemini is integrated into service-request analysis and matching workflows.
- **Operational error handling:** the application includes centralized error-handling improvements to provide more understandable user-facing feedback.
- **Automated tests:** Jest and React Native Testing Library are included in the development toolchain.

## Running locally

### Requirements

- Node.js and npm
- Android Studio / Android SDK for Android development, or an available iOS development environment
- A configured Supabase project
- The required environment variables and service configuration

### Setup

```bash
npm install
```

Create a local `.env` file and provide the project's public Supabase configuration:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Then start the Expo development server:

```bash
npx expo start
```

For an Android development build:

```bash
npx expo start --dev-client --android
```

> Backend functions and database migrations require their corresponding Supabase configuration. Never commit private service-role keys, AI provider secrets, or other credentials to the repository.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Expo development server |
| `npm run android` | Start the Android development workflow |
| `npm run ios` | Start the iOS development workflow |
| `npm test` | Run the Jest test suite |
| `npm run lint` | Run the configured Expo lint command |

## Application

The Android build is available here:

**[https://sho-bdk-download.vercel.app](https://sho-bdk-download.vercel.app)**

---

*Sho Bdk is an independently developed software project. This repository contains the mobile application source code; backend services and external integrations may require separate configuration and access.*
