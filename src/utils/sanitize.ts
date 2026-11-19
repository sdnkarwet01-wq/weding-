export function sanitizeText(value: string, maxLength = 500): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function isValidHttpOrLocalUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/uploads/') || url.startsWith('/src/assets/') || url.startsWith('builtin:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildGuestUrl(slug: string, guestName: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const encoded = encodeURIComponent(guestName.trim()).replace(/%20/g, '+');
  return `${origin}/wedding/${slug}?to=${encoded}`;
}

export function buildWhatsAppShareUrl(
  guestName: string,
  brideNickname: string,
  groomNickname: string,
  weddingDate: string,
  personalUrl: string
): string {
  const formattedDate = formatReadableDate(weddingDate);
  const message = [
    `Kepada Yth. ${guestName},`,
    '',
    `Dengan memohon rahmat dan ridho Tuhan Yang Maha Esa, kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami:`,
    `*${groomNickname} & ${brideNickname}*`,
    formattedDate ? `Tanggal: ${formattedDate}` : '',
    '',
    `Buka undangan digital personal Anda melalui tautan berikut:`,
    personalUrl,
    '',
    `Merupakan kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu.`,
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return 'Date to be announced';
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function parseCsvGuestRows(rawText: string): Array<{ guestName: string; guestGroup: string }> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: Array<{ guestName: string; guestGroup: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip header row if detected
    if (i === 0 && /^name\b|^guest/i.test(line)) {
      continue;
    }
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());

    const guestName = sanitizeText(cols[0] || '', 100);
    const guestGroup = sanitizeText(cols[1] || 'Friends & Family', 60) || 'Friends & Family';
    if (guestName.length >= 1) {
      results.push({ guestName, guestGroup });
    }
  }

  return results;
}

export interface TimezoneMeta {
  iana: 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';
  offset: '+07:00' | '+08:00' | '+09:00';
  abbr: 'WIB' | 'WITA' | 'WIT';
}

export function getTimezoneMeta(tz?: string): TimezoneMeta {
  if (tz === 'Asia/Makassar') {
    return { iana: 'Asia/Makassar', offset: '+08:00', abbr: 'WITA' };
  }
  if (tz === 'Asia/Jayapura') {
    return { iana: 'Asia/Jayapura', offset: '+09:00', abbr: 'WIT' };
  }
  return { iana: 'Asia/Jakarta', offset: '+07:00', abbr: 'WIB' };
}

export function downloadCalendarIcs(params: {
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  timezone?: string;
  venue: string;
  address: string;
  description: string;
}) {
  const tzMeta = getTimezoneMeta(params.timezone);
  const cleanDate = (params.date || '2027-06-19').replace(/-/g, '');
  const start = (params.startTime || '09:00').replace(':', '') + '00';
  const end = (params.endTime || '12:00').replace(':', '') + '00';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WEDLINK//Wedding Invitation//EN',
    'BEGIN:VEVENT',
    `UID:wedlink-${Date.now()}@wedlink.studio`,
    `DTSTAMP:${cleanDate}T${start}`,
    `DTSTART;TZID=${tzMeta.iana}:${cleanDate}T${start}`,
    `DTEND;TZID=${tzMeta.iana}:${cleanDate}T${end}`,
    `SUMMARY:${params.title}`,
    `LOCATION:${params.venue}, ${params.address}`,
    `DESCRIPTION:${params.description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeSlug(params.title) || 'wedding-event'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
