-- بذور اختيارية: نصوص «الانطباع الاحترافي» (لغة بيعية فاخرة) لمدن محددة.
-- نفّذ بعد destinations_guide.sql. لا يمس الحقول الأخرى عند التحديث.

-- اليابان: طوكيو + كيوتو (نفس النص الاستراتيجي للمنطقة)
INSERT INTO public.destinations_guide (country_id, city_id, professional_impression)
VALUES
  (
    'japan',
    'tokyo',
    $jp$
اليابان هي سيمفونية التناقض المذهل؛ حيث يلتقي صمت معابد كيوتو الخشبية بضجيج شيبويا النيوني. الانطباع: ليست مجرد رحلة، بل هي انتقال لزمن آخر. نصيحة للموظف: انصح العميل دائماً بتجربة (الريوكان) ولو لليلة واحدة ليعيش روح الضيافة اليابانية الأصلية (أوموتيناشي).
$jp$
  ),
  (
    'japan',
    'kyoto',
    $jp$
اليابان هي سيمفونية التناقض المذهل؛ حيث يلتقي صمت معابد كيوتو الخشبية بضجيج شيبويا النيوني. الانطباع: ليست مجرد رحلة، بل هي انتقال لزمن آخر. نصيحة للموظف: انصح العميل دائماً بتجربة (الريوكان) ولو لليلة واحدة ليعيش روح الضيافة اليابانية الأصلية (أوموتيناشي).
$jp$
  )
ON CONFLICT (country_id, city_id) DO UPDATE SET
  professional_impression = EXCLUDED.professional_impression,
  updated_at = now();

-- البرتغال: لشبونة + بورتو
INSERT INTO public.destinations_guide (country_id, city_id, professional_impression)
VALUES
  (
    'portugal',
    'lisbon',
    $pt$
جمال شاعري مائل للحزن (Saudade) مع غروب شمس يغسل جدران السيراميك الملونة. الانطباع: البرتغال دافئة، أصيلة، وغير متكلفة. نصيحة للموظف: ركز على تجربة الطعام البحري في (Cascais) والمشي في أزقة (Alfama).
$pt$
  ),
  (
    'portugal',
    'porto',
    $pt$
جمال شاعري مائل للحزن (Saudade) مع غروب شمس يغسل جدران السيراميك الملونة. الانطباع: البرتغال دافئة، أصيلة، وغير متكلفة. نصيحة للموظف: ركز على تجربة الطعام البحري في (Cascais) والمشي في أزقة (Alfama).
$pt$
  )
ON CONFLICT (country_id, city_id) DO UPDATE SET
  professional_impression = EXCLUDED.professional_impression,
  updated_at = now();

-- إيطاليا: روما، فلورنسا، نابولي (ساحل أمالفي / توسكانا في النص)
INSERT INTO public.destinations_guide (country_id, city_id, professional_impression)
VALUES
  (
    'italy',
    'rome',
    $it$
متحف مفتوح لا ينتهي. الانطباع: الحياة هناك تسمى (La Dolce Vita) أو الحياة الحلوة. نصيحة للموظف: لا تركز فقط على المعالم التاريخية، بل ركز على تجارب (تذوق زيت الزيتون في توسكانا) أو ركوب القوارب في أمالفي.
$it$
  ),
  (
    'italy',
    'florence',
    $it$
متحف مفتوح لا ينتهي. الانطباع: الحياة هناك تسمى (La Dolce Vita) أو الحياة الحلوة. نصيحة للموظف: لا تركز فقط على المعالم التاريخية، بل ركز على تجارب (تذوق زيت الزيتون في توسكانا) أو ركوب القوارب في أمالفي.
$it$
  ),
  (
    'italy',
    'naples',
    $it$
متحف مفتوح لا ينتهي. الانطباع: الحياة هناك تسمى (La Dolce Vita) أو الحياة الحلوة. نصيحة للموظف: لا تركز فقط على المعالم التاريخية، بل ركز على تجارب (تذوق زيت الزيتون في توسكانا) أو ركوب القوارب في أمالفي.
$it$
  )
ON CONFLICT (country_id, city_id) DO UPDATE SET
  professional_impression = EXCLUDED.professional_impression,
  updated_at = now();
