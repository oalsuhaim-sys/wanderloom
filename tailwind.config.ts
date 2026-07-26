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
 *   gold     #C5A059  Wanderloom Gold
 *   charcoal #0A0F0C
 *   offwhite #F9F9F6
 */
const config = {
  darkMode: 'class' as const,
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1A3B2A',
          dark: '#0B1912',
          surface: '#12261B',
          gold: '#C5A059',
          charcoal: '#0A0F0C',
          offwhite: '#F9F9F6',
          muted: '#8FA396',
        },
      },
    },
  },
};

export default config;
