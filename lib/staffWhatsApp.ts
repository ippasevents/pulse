import { BusinessSettings, EventRecord, Shift, StaffMember } from './types';

export type WhatsAppTemplateLang = 'bilingual' | 'english';

/**
 * Normalizes Indian & international phone numbers for https://wa.me/<digits>
 * - Strips spaces, +, -, parentheses
 * - Strips leading '0' on 11-digit numbers (e.g. 09847012345 -> 919847012345)
 * - Prepends '91' (India) on standard 10-digit mobile numbers
 */
export function normalizeWhatsAppPhone(
  rawPhone?: string | null,
  defaultCountryCode: string = '91'
): string {
  const digits = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  return digits;
}

export function formatDisplayWhatsAppPhone(rawPhone?: string | null): string {
  const normalized = normalizeWhatsAppPhone(rawPhone);
  if (!normalized) return '';
  if (normalized.length === 12 && normalized.startsWith('91')) {
    return `+91 ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
  }
  return `+${normalized}`;
}

export function formatShiftTime12h(isoOrTime?: string): string {
  if (!isoOrTime) return '';
  const hhmm = isoOrTime.includes('T') ? isoOrTime.slice(11, 16) : isoOrTime.slice(0, 5);
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatEventDateReadable(dateStr?: string): string {
  if (!dateStr) return 'TBD';
  const parsed = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatStaffShiftWhatsAppMessage(params: {
  shift: Shift;
  staff?: StaffMember;
  event?: EventRecord;
  settings?: BusinessSettings;
  hours?: number;
  customNote?: string;
  lang?: WhatsAppTemplateLang;
  portalUrl?: string;
}): string {
  const {
    shift,
    staff,
    event,
    settings,
    hours,
    customNote,
    lang = 'bilingual',
    portalUrl
  } = params;

  const companyName = settings?.name || 'IPPAS Food Service & Events';
  const staffName = staff?.name || 'Team Member';
  const roleName = shift.role_label || staff?.role_title || 'Event Crew';
  const eventTitle = event?.title || 'Catering Event';
  const eventDate = formatEventDateReadable(event?.event_date);
  const venue = event?.venue || 'Venue details shared by coordinator';
  const start12 = formatShiftTime12h(shift.starts_at);
  const end12 = formatShiftTime12h(shift.ends_at);
  const hrsText = hours != null && hours > 0 ? ` (${hours} hrs)` : '';
  const guestsText = event?.guest_count ? `${event.guest_count} Guests` : '';
  const noteText = (customNote ?? shift.duty_note ?? '').trim();
  const appLink =
    portalUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  if (lang === 'english') {
    const lines = [
      `📋 *${companyName}*`,
      `*EVENT DUTY ASSIGNMENT*`,
      `────────────────────`,
      `👤 *Staff:* ${staffName}`,
      `🎖️ *Assigned Role:* ${roleName}`,
      ``,
      `🎉 *Event:* ${eventTitle}`,
      `📅 *Date:* ${eventDate}`,
      `⏰ *Shift Time:* ${start12} – ${end12}${hrsText}`,
      `📍 *Venue:* ${venue}`,
      guestsText ? `👥 *Expected Guests:* ${guestsText}` : '',
      noteText ? `\n📝 *Instructions:* ${noteText}` : '',
      ``,
      `Please report on time in proper uniform. Reply *OK* to confirm your duty.`,
      appLink ? `🔗 *Staff Portal:* ${appLink}` : ''
    ];
    return lines.filter(Boolean).join('\n');
  }

  // Default Bilingual (Malayalam + English) for clear understanding by all catering crew
  const lines = [
    `📋 *${companyName}*`,
    `*EVENT DUTY NOTIFICATION | ഇവന്റ് ഡ്യൂട്ടി അറിയിപ്പ്*`,
    `────────────────────`,
    `നമസ്കാരം *${staffName}*,`,
    `നിങ്ങൾക്ക് താഴെ പറയുന്ന ഇവന്റിൽ ഡ്യൂട്ടി അസൈൻ ചെയ്തിട്ടുണ്ട്:`,
    ``,
    `🎉 *ഇവന്റ് (Event):* ${eventTitle}`,
    `🎖️ *റോൾ (Role):* ${roleName}`,
    `📅 *തീയതി (Date):* ${eventDate}`,
    `⏰ *സമയം (Duty Time):* ${start12} – ${end12}${hrsText}`,
    `📍 *സ്ഥലം (Venue):* ${venue}`,
    guestsText ? `👥 *അതിഥികൾ (Guests):* ${guestsText}` : '',
    noteText ? `\n📝 *പ്രത്യേക നിർദ്ദേശം:* ${noteText}` : '',
    ``,
    `കൃത്യസമയത്ത് യൂണിഫോമിൽ എത്തിച്ചേരുക. ഡ്യൂട്ടി കൺഫേം ചെയ്യാൻ *OK* എന്ന് മറുപടി അയക്കുക.`,
    appLink ? `🔗 *App Link:* ${appLink}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatEventCrewRosterMessage(params: {
  event: EventRecord;
  shifts: Shift[];
  staffList: StaffMember[];
  settings?: BusinessSettings;
  calculateHours: (start: string, end: string) => number;
}): string {
  const { event, shifts, staffList, settings, calculateHours } = params;
  const companyName = settings?.name || 'IPPAS Food Service & Events';
  const eventDate = formatEventDateReadable(event.event_date);

  const crewLines = shifts.map((sh, idx) => {
    const st = staffList.find((s) => s.id === sh.staff_member_id);
    const role = sh.role_label || st?.role_title || 'Crew';
    const hrs = calculateHours(sh.starts_at, sh.ends_at);
    return `${idx + 1}. *${st?.name || 'Staff'}* — ${role} (${formatShiftTime12h(sh.starts_at)} - ${formatShiftTime12h(sh.ends_at)}, ${hrs}h)`;
  });

  return [
    `📋 *${companyName}*`,
    `*EVENT CREW DUTY ROSTER*`,
    `────────────────────`,
    `🎉 *Event:* ${event.title}`,
    `📅 *Date:* ${eventDate}`,
    `📍 *Venue:* ${event.venue || 'TBD'}`,
    `👥 *Guests:* ${event.guest_count}`,
    ``,
    `*Assigned Team (${shifts.length}):*`,
    ...crewLines,
    ``,
    `All assigned crew members please report on time.`
  ].join('\n');
}

export function buildWhatsAppDirectUrl(rawPhone: string | undefined, message: string): string {
  const cleanPhone = normalizeWhatsAppPhone(rawPhone);
  const encoded = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
