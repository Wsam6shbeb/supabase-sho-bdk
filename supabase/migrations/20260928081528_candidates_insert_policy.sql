-- ============================================================================
-- سياسة إدراج ناقصة بجدول candidates
-- ============================================================================
-- المخطط الأساسي أضاف سياسة select فقط (candidates_read) بدون insert.
-- حالياً منطق "المطابقة" يشتغل بالواجهة الأمامية (بحث بسيط عن مزوّدين
-- متاحين)، وليس بدالة سيرفر مخصصة، فبنسمح لصاحب طلب الخدمة (requester)
-- بحفظ نتائج البحث الخاصة بطلبه فقط كمرشحين — بنفس نطاق سياسة القراءة.
create policy candidates_requester_insert on candidates for insert
  with check (
    exists (
      select 1 from service_requests r
      where r.id = candidates.request_id and r.requester_id = auth.uid()
    )
  );
