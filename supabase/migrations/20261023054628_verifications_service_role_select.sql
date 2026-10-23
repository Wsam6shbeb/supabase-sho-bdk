-- لوحة التحكم تقرأ طلبات التوثيق بدور service_role، والمشروع يمنح هذا الدور أقل صلاحيات ممكنة لكل جدول.
-- القراءة فقط؛ القبول/الرفض يمرّ عبر decide_verification (security definer).
grant select on public.verifications to service_role;
