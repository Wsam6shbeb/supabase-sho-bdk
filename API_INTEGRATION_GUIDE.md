# Frontend API Integration Guide

هذا المشروع يستخدم طبقة API مستقلة عن الشاشات.

## الوضع الحالي

- `mock`: الوضع الافتراضي للتطوير المحلي.
- `http`: طبقة HTTP جاهزة للربط مع Backend حقيقي عبر `EXPO_PUBLIC_API_URL`.

## قاعدة مهمة

الشاشات لا تتعامل مع قاعدة البيانات مباشرة. الـFrontend يتعامل مع API Contract فقط.

```text
Screen
  ↓
Hook / Context
  ↓
API Contract
  ↓
Mock Adapter أو HTTP Adapter
  ↓
Backend
  ↓
Database
```

## المطلوب من Backend Developer

1. تثبيت المسارات الفعلية تحت `/api/v1`.
2. مطابقة JSON request/response مع `src/services/api/contracts.ts`.
3. توثيق أكواد الأخطاء.
4. دعم `Authorization: Bearer <token>`.
5. دعم `Idempotency-Key` للعمليات الحساسة، خصوصًا الاتفاق والخصم والتقييم والبلاغ والحظر.
6. إعادة `request_id` في أخطاء API لتسهيل الدعم والتتبع.
7. توفير staging URL قبل ربط الإنتاج.

## عمليات مالية

الـFrontend لا يحسب أو يخصم العمولة فعليًا. يعرض snapshot القادم من Backend.

## حالات الاتفاق

الـFrontend يعرض حالة الاتفاق القادمة من Backend ولا يكتب حالة مالية أو state حساسة مباشرة.

## Realtime

المحادثات والإشعارات يمكن ربطها لاحقًا بـWebSocket/SSE. طبقة الـAPI الحالية لا تفترض بروتوكول realtime محددًا حتى يتم اعتماده مع Backend.
