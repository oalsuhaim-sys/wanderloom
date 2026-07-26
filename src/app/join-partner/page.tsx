import JoinPartnerForm, { JoinPartnerPageShell } from './JoinPartnerForm'

export const metadata = {
  title: 'انضم كشريك | Wanderloom',
  description:
    'نبحث عن قادة رحلات وخبراء وجهات شغوفين لنسج تجارب سفر استثنائية.',
}

export default function JoinPartnerPage() {
  return (
    <JoinPartnerPageShell>
      <JoinPartnerForm />
    </JoinPartnerPageShell>
  )
}
