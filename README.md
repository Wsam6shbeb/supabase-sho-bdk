# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out your project

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://expo.github.io/router/docs).

## Feature brief: Browse services (شو بدك)

**Working branch:** `feature/service-browsing`

### Agreed goal
Add a second way for customers to find a provider: browse providers and choose one manually, in addition to the existing **اطلب خدمة** flow.

### Home screen — exact button order
The home screen must show **three separate buttons**, stacked vertically in this exact order:

1. **قدّم خدمة** — the top button, full screen width.
2. **اطلب خدمة** — directly underneath the first button; preserve its current behavior.
3. **تصفّح الخدمات** — underneath the second button; tapping it opens the new service-browsing screen described below.

Do not combine these buttons, change their order, or replace either existing action. The third button is the entry point to browse providers manually.

### Browse screen
When the customer taps **تصفّح الخدمات**, open a new screen with filters at the top and provider results below.

Required filters:
1. **المحافظة** — select a governorate.
2. **المنطقة** — options must depend on the selected governorate.
3. **نوع الخدمة** — allow the customer to type a service name and/or choose from actual service categories already supported by the app.
4. A clear **بحث** action to apply the filters.

Show matching provider cards below the filters. Use only real data from the existing database; never show mock/demo providers in production.

### Provider cards and contact
Show useful information only when it exists in the current data model, such as provider name, offered services, area, profile photo, and rating/review count. Provide a way to open the provider profile and a **تواصل** action.

The contact action must reuse the app's existing conversation creation/opening flow and its existing eligibility checks. Do not create a parallel chat system. Confirm how a manually selected provider is associated with the relevant service/request before implementing contact; do not invent a request or agreement.

### Scope and safety constraints
- Work only on this branch: `feature/service-browsing`.
- Never commit, merge, cherry-pick, or push changes to `main`.
- Keep changes limited to the home-screen entry point, the new browse screen, and the minimum supporting query/navigation code required.
- Do not change the existing **اطلب خدمة** matching flow.
- Do not change agreement, chat permissions/statuses, commission, wallet, payment, or accounting logic.
- Do not change database schema, migrations, RLS policies, Supabase settings, Edge Functions, or server secrets unless a concrete requirement is proven and separately approved. Prefer the existing schema and APIs.
- Do not weaken provider eligibility, verification, suspension, availability, or privacy checks. Do not expose private provider/customer data.
- Preserve Arabic RTL and the current app design conventions.
- Avoid adding dependencies unless essential.
- Do not make unrelated refactors or formatting changes.

### Before coding
Inspect the actual current project files, database types/queries, provider profile structure, governorate/area representation, service-category model, provider availability rules, and existing conversation flow. Report the exact files and data fields that will be used. If a required filter or contact flow cannot be supported safely with existing data, stop and explain the gap rather than guessing or changing the database.

### Validation and handoff
Test filtering by governorate, dependent area, and service; empty results; loading/error states; provider eligibility; profile navigation; and contact flow. Run the relevant tests and TypeScript checks. Clearly list what was tested and what could not be tested.

Do not deploy or publish a production build. Do not merge this branch. The branch and this README are a handoff brief for implementation/review; all changes must remain isolated until explicitly approved.

---

## Original Expo setup notes

To reset the project template, run:

```bash
npm run reset-project
```

For linting, run `npx expo lint`. For testing, see the [Expo unit testing guide](https://docs.expo.dev/develop/unit-testing/).

Learn more in the [Expo documentation](https://docs.expo.dev/).
