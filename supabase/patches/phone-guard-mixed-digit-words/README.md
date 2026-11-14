# Phone guard: mixed spoken digits and numeric groups

This patch closes the chat bypass where spoken digits are followed by a grouped number, for example:
«صفر تسعة اربعة اربعة خمسة تلاتة واحد 345».

## Included
- Updated `src/domain/chatSafety.ts` with invisible-character cleanup, NFKC normalization, separated Syrian prefixes, and mixed digit/group detection.
- Jest regression tests including ordinary prices and addresses to limit false positives.
- SQL migration replacing `public.contains_phone_number(text)` and adding a shared normalizer.
- SQL regression test.

## Apply safely
1. Review the branch diff.
2. Run Jest: `npx jest src/domain/__tests__/chatSafety.mixedPhone.test.ts --runInBand`.
3. Apply the migration only to the scratch/test database first.
4. Run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/sql/05_phone_guard_mixed_digit_words.sql`.
5. Test an actual chat message on the test app.

The SQL migration assumes the existing chat trigger already calls `public.contains_phone_number(new.body)`, as described in the implementation notes. Verify that dependency in the target database before applying. This patch does not execute any SQL or touch a Supabase project.

## Rollback
Do not blindly drop `contains_phone_number`: it replaces an existing function. Before applying the migration, save the current definitions using:
`select pg_get_functiondef('public.contains_phone_number(text)'::regprocedure);`
and
`select pg_get_functiondef('public.reject_phone_numbers_in_chat_message()'::regprocedure);`
To roll back, restore those exact saved definitions. This is intentionally safer than guessing the previous live database function.
