# Phone guard: mixed spoken digits and numeric groups

This patch closes the bypass where spoken digits are followed by grouped numbers, for example:
«صفر تسعة اربعة اربعة خمسة تلاتة واحد 345».

## Included
- Updated `src/domain/chatSafety.ts` with invisible-character cleanup, NFKC normalization, separated Syrian prefixes, and mixed digit/group detection.
- Jest regression tests including ordinary prices and addresses to limit false positives.
- SQL migration adds a shared normalizer, extends `contains_phone_number(text)` for structured free-text fields, and updates the chat trigger to use that same detector.
- SQL regression test checks both the shared detector and the actual chat trigger on a temporary table.

## Apply safely
1. Review the branch diff.
2. Run Jest: `npx jest src/domain/__tests__/chatSafety.mixedPhone.test.ts --runInBand`.
3. Test the migration inside a transaction on the scratch/test database first; do not apply it to production.
4. Run `supabase/tests/sql/05_phone_guard_mixed_digit_words.sql` against the test database.
5. Test an actual chat message and a `structured_data` value on the test app.

The migration keeps the existing chat trigger's message-type restriction and trusted server-message behavior. It does not change the trigger's table or event configuration.

## Rollback
Before applying the migration, save the current definitions using:
`select pg_get_functiondef('public.contains_phone_number(text)'::regprocedure);`
`select pg_get_functiondef('public.reject_phone_numbers_in_chat_message()'::regprocedure);`

To roll back, restore those exact saved definitions. This is intentionally safer than guessing the previous live database functions.
