<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:design-lock -->
# Design lock — read before any change

The public site's «loom» design (colors, fonts, layout, components) is approved by the owner.
**Do not change how the site looks unless the task explicitly asks for a visual change** — if it
does, stop and ask first. Full rules (protected files, palette, copy rules, deploy flow):
`.cursor/rules/design-lock.mdc`.

- Fix logic/data inside protected components but keep their JSX structure and `className`s.
- Approved slogan, verbatim: «واندرلوم: تفصيل لا تنظيم».
- Never deploy with `vercel --prod` from a laptop: branch → PR → Vercel preview → owner approves → merge.
<!-- END:design-lock -->
