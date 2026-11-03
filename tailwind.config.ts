/**
 * Wanderloom uses Tailwind CSS v4 — theme tokens live in `src/app/globals.css`
 * (`@theme inline` + `@custom-variant dark`).
 *
 * Dark mode is class-based: add `.dark` on an ancestor (CRM: `.crm-command-center.dark`).
 *
 * Brand palette:
 *   primary  #1A3B2A  Forest Green
 *   dark     #0B1912  Midnight Green (dark bg)
 *   surface  #12261B  Dark cards
 *   gold     #D4AF37  Wanderloom Gold (زر توليد المسار بـ AI)
 *   charcoal #0A0F0C
 *   offwhite #F9F9F6
 */
const config = {
  darkMode: 'class' as const,
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-tajawal)', 'Tajawal', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#1A3B2A',
          dark: '#0B1912',
          surface: '#12261B',
          gold: '#D4AF37',
          charcoal: '#0A0F0C',
          offwhite: '#F9F9F6',
          muted: '#8FA396',
        },
        amber: {
          50: '#FDFBF7',
          100: '#F7F0E1',
          200: '#E8D2A7',
          500: '#D4AF37',
          600: '#C4A030',
          700: '#8C6D23',
          900: '#4A3910',
        },
      },
    },
  },
};

export default config;
