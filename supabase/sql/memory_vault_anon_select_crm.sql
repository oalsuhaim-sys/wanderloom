-- قراءة ذكريات العملاء من لوحة CRM (عميل anon كباقي صفحات المشروع الداخلية)
-- راجع أمانك في الإنتاج؛ يُفضّل استبدالها بسياسة role أو جلسة موظف فقط.

drop policy if exists "memory_vault_anon_select" on public.memory_vault;
create policy "memory_vault_anon_select"
  on public.memory_vault
  for select
  to anon
  using (true);
