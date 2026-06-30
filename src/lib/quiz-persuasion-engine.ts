import type { Dictionary } from '@/context/LanguageContext';

export type PersuasionEvidence = {
  userAnswer: string;
  destination: string;
  description: string;
  icon: string;
};

type QuizQuestions = Dictionary['quiz']['questions'];

const JAPAN_PERSUASION_ITEMS: PersuasionEvidence[] = [
  {
    userAnswer: 'البحث عن الهدوء',
    destination: '',
    description:
      'اخترنا لك حديقة Gio-ji المخفية في كيوتو لتجربة تأملية بعيداً عن السياح.',
    icon: '🍃',
  },
  {
    userAnswer: 'عشق التاريخ',
    destination: '',
    description:
      'رتبنا لك زيارة خاصة لمنزل عائلة Nomura، سليل الساموراي الحقيقي.',
    icon: '🏯',
  },
  {
    userAnswer: 'التميز والحصرية',
    destination: '',
    description:
      'حجزنا لك في ريوكان (Ryokan) سري لا يملك واجهة باللغة الإنجليزية.',
    icon: '👑',
  },
];

function buildGenericEvidence(
  questions: QuizQuestions,
  answers: Record<string, number>,
  countryName: string,
): PersuasionEvidence[] {
  const picked = questions
    .map((question) => {
      const idx = answers[question.id];
      if (idx == null) return null;
      const label = question.options[idx]?.label;
      if (!label) return null;
      return { question: question.prompt, label };
    })
    .filter((item): item is { question: string; label: string } => item != null)
    .slice(0, 3);

  if (picked.length === 0) {
    return [
      {
        userAnswer: 'تفضيلاتك الفريدة',
        destination: `مسار VIP حصري في ${countryName}`,
        description: `صممنا لك تجربة off-the-radar في ${countryName} بعيداً عن المسارات السياحية الجاهزة.`,
        icon: '✨',
      },
    ];
  }

  const icons = ['🍃', '🏯', '👑'];
  return picked.map((item, i) => ({
    userAnswer: item.label.split('—')[0]?.trim() || item.label,
    destination: `وجهة حصرية #${i + 1} في ${countryName}`,
    description: `لأنك اخترت «${item.label}»، نربط إجابتك بمحطة خاصة لا تظهر في دليل السفر التقليدي — بتنسيق Wanderloom.`,
    icon: icons[i] ?? '✨',
  }));
}

export function buildPersuasionEvidence(
  questions: QuizQuestions,
  answers: Record<string, number>,
  destinationKey: string,
  countryName: string,
): PersuasionEvidence[] {
  if (destinationKey === 'japan') {
    return JAPAN_PERSUASION_ITEMS;
  }
  return buildGenericEvidence(questions, answers, countryName);
}
