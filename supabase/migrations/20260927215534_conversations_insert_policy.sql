-- ============================================================================
-- سياسة إدراج ناقصة بجدول conversations
-- ============================================================================
-- المخطط الأساسي أضاف سياستي select/update فقط لأطراف المحادثة
-- (conv_parties_select, conv_parties_update) بدون سياسة insert، ما يعني
-- إنو العميل (requester) ما فيه ينشئ محادثة جديدة أصلاً من التطبيق.
-- بما إنو ما في دالة RPC مخصصة لإنشاء المحادثة (بعكس create_agreement)،
-- نضيف سياسة insert تسمح فقط لصاحب طلب الخدمة (requester) بإنشاء محادثة
-- لنفسه.
create policy conv_requester_insert on conversations for insert
  with check (auth.uid() = requester_id);
