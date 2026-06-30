-- بيانات تجريبية (عدّل الدولة/المدينة لتطابق فنادقك وتجاربك في CRM)
insert into public.secret_places (name, description, maps_url, country, city)
values
  (
    'مقهى الساعة الزرقاء',
    'زاوية هادئة بعيداً عن مسارات السياح — مثالي لصباح بطيء وقراءة خفيفة.',
    'https://www.google.com/maps/search/?api=1&query=Blue+Hour+Cafe+Zurich',
    'Switzerland',
    'Zurich'
  ),
  (
    'ممر الإطلالة الذهبية',
    'نقطة تصوير محلية نادرة تطل على المدينة دون الزحام المعتاد.',
    'https://www.google.com/maps/search/?api=1&query=Zurich+viewpoint',
    'Switzerland',
    null
  );
