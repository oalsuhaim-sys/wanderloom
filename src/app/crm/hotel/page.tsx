import { redirect } from 'next/navigation';

/** المسار السابق /crm/hotel → الدليل الجديد */
export default function HotelRedirectPage() {
  redirect('/crm/hotels');
}
