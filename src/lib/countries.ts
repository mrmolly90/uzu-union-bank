/* ==========================================================================
   UZU UNION BANK — Country & Currency Data
   60+ countries with their currencies, flags, and regional info.
   ========================================================================== */

export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  currencyName: string;
  flag: string;
  region: string;
  phoneCode: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'US', name: 'United States', currency: 'USD', currencyName: 'US Dollar', flag: '🇺🇸', region: 'Americas', phoneCode: '+1' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', currencyName: 'British Pound', flag: '🇬🇧', region: 'Europe', phoneCode: '+44' },
  { code: 'EU', name: 'European Union', currency: 'EUR', currencyName: 'Euro', flag: '🇪🇺', region: 'Europe', phoneCode: '+' },
  { code: 'JP', name: 'Japan', currency: 'JPY', currencyName: 'Japanese Yen', flag: '🇯🇵', region: 'Asia', phoneCode: '+81' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', currencyName: 'Swiss Franc', flag: '🇨🇭', region: 'Europe', phoneCode: '+41' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', currencyName: 'Singapore Dollar', flag: '🇸🇬', region: 'Asia', phoneCode: '+65' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', currencyName: 'UAE Dirham', flag: '🇦🇪', region: 'Middle East', phoneCode: '+971' },
  { code: 'AF', name: 'Afghanistan', currency: 'AFN', currencyName: 'Afghan Afghani', flag: '🇦🇫', region: 'Asia', phoneCode: '+93' },
  { code: 'AL', name: 'Albania', currency: 'ALL', currencyName: 'Albanian Lek', flag: '🇦🇱', region: 'Europe', phoneCode: '+355' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', currencyName: 'Armenian Dram', flag: '🇦🇲', region: 'Asia', phoneCode: '+374' },
  { code: 'AO', name: 'Angola', currency: 'AOA', currencyName: 'Angolan Kwanza', flag: '🇦🇴', region: 'Africa', phoneCode: '+244' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', currencyName: 'Argentine Peso', flag: '🇦🇷', region: 'Americas', phoneCode: '+54' },
  { code: 'AU', name: 'Australia', currency: 'AUD', currencyName: 'Australian Dollar', flag: '🇦🇺', region: 'Oceania', phoneCode: '+61' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', currencyName: 'Azerbaijani Manat', flag: '🇦🇿', region: 'Asia', phoneCode: '+994' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', currencyName: 'Bangladeshi Taka', flag: '🇧🇩', region: 'Asia', phoneCode: '+880' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', currencyName: 'Bulgarian Lev', flag: '🇧🇬', region: 'Europe', phoneCode: '+359' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', currencyName: 'Bahraini Dinar', flag: '🇧🇭', region: 'Middle East', phoneCode: '+973' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', currencyName: 'Brazilian Real', flag: '🇧🇷', region: 'Americas', phoneCode: '+55' },
  { code: 'CA', name: 'Canada', currency: 'CAD', currencyName: 'Canadian Dollar', flag: '🇨🇦', region: 'Americas', phoneCode: '+1' },
  { code: 'CN', name: 'China', currency: 'CNY', currencyName: 'Chinese Yuan', flag: '🇨🇳', region: 'Asia', phoneCode: '+86' },
  { code: 'CO', name: 'Colombia', currency: 'COP', currencyName: 'Colombian Peso', flag: '🇨🇴', region: 'Americas', phoneCode: '+57' },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK', currencyName: 'Czech Koruna', flag: '🇨🇿', region: 'Europe', phoneCode: '+420' },
  { code: 'DE', name: 'Germany', currency: 'EUR', currencyName: 'Euro', flag: '🇩🇪', region: 'Europe', phoneCode: '+49' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', currencyName: 'Danish Krone', flag: '🇩🇰', region: 'Europe', phoneCode: '+45' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', currencyName: 'Algerian Dinar', flag: '🇩🇿', region: 'Africa', phoneCode: '+213' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', currencyName: 'Egyptian Pound', flag: '🇪🇬', region: 'Africa', phoneCode: '+20' },
  { code: 'ES', name: 'Spain', currency: 'EUR', currencyName: 'Euro', flag: '🇪🇸', region: 'Europe', phoneCode: '+34' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', currencyName: 'Ethiopian Birr', flag: '🇪🇹', region: 'Africa', phoneCode: '+251' },
  { code: 'FR', name: 'France', currency: 'EUR', currencyName: 'Euro', flag: '🇫🇷', region: 'Europe', phoneCode: '+33' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', currencyName: 'Ghanaian Cedi', flag: '🇬🇭', region: 'Africa', phoneCode: '+233' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', currencyName: 'Hong Kong Dollar', flag: '🇭🇰', region: 'Asia', phoneCode: '+852' },
  { code: 'HR', name: 'Croatia', currency: 'HRK', currencyName: 'Croatian Kuna', flag: '🇭🇷', region: 'Europe', phoneCode: '+385' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', currencyName: 'Hungarian Forint', flag: '🇭🇺', region: 'Europe', phoneCode: '+36' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', currencyName: 'Indonesian Rupiah', flag: '🇮🇩', region: 'Asia', phoneCode: '+62' },
  { code: 'IL', name: 'Israel', currency: 'ILS', currencyName: 'Israeli Shekel', flag: '🇮🇱', region: 'Middle East', phoneCode: '+972' },
  { code: 'IN', name: 'India', currency: 'INR', currencyName: 'Indian Rupee', flag: '🇮🇳', region: 'Asia', phoneCode: '+91' },
  { code: 'IQ', name: 'Iraq', currency: 'IQD', currencyName: 'Iraqi Dinar', flag: '🇮🇶', region: 'Middle East', phoneCode: '+964' },
  { code: 'IS', name: 'Iceland', currency: 'ISK', currencyName: 'Icelandic Króna', flag: '🇮🇸', region: 'Europe', phoneCode: '+354' },
  { code: 'IT', name: 'Italy', currency: 'EUR', currencyName: 'Euro', flag: '🇮🇹', region: 'Europe', phoneCode: '+39' },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', currencyName: 'Jamaican Dollar', flag: '🇯🇲', region: 'Americas', phoneCode: '+1' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', currencyName: 'Jordanian Dinar', flag: '🇯🇴', region: 'Middle East', phoneCode: '+962' },
  { code: 'KE', name: 'Kenya', currency: 'KES', currencyName: 'Kenyan Shilling', flag: '🇰🇪', region: 'Africa', phoneCode: '+254' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', currencyName: 'South Korean Won', flag: '🇰🇷', region: 'Asia', phoneCode: '+82' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', currencyName: 'Kuwaiti Dinar', flag: '🇰🇼', region: 'Middle East', phoneCode: '+965' },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', currencyName: 'Kazakhstani Tenge', flag: '🇰🇿', region: 'Asia', phoneCode: '+7' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP', currencyName: 'Lebanese Pound', flag: '🇱🇧', region: 'Middle East', phoneCode: '+961' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', currencyName: 'Sri Lankan Rupee', flag: '🇱🇰', region: 'Asia', phoneCode: '+94' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', currencyName: 'Moroccan Dirham', flag: '🇲🇦', region: 'Africa', phoneCode: '+212' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', currencyName: 'Mexican Peso', flag: '🇲🇽', region: 'Americas', phoneCode: '+52' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', currencyName: 'Malaysian Ringgit', flag: '🇲🇾', region: 'Asia', phoneCode: '+60' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', currencyName: 'Nigerian Naira', flag: '🇳🇬', region: 'Africa', phoneCode: '+234' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', currencyName: 'Euro', flag: '🇳🇱', region: 'Europe', phoneCode: '+31' },
  { code: 'NO', name: 'Norway', currency: 'NOK', currencyName: 'Norwegian Krone', flag: '🇳🇴', region: 'Europe', phoneCode: '+47' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', currencyName: 'New Zealand Dollar', flag: '🇳🇿', region: 'Oceania', phoneCode: '+64' },
  { code: 'OM', name: 'Oman', currency: 'OMR', currencyName: 'Omani Rial', flag: '🇴🇲', region: 'Middle East', phoneCode: '+968' },
  { code: 'PE', name: 'Peru', currency: 'PEN', currencyName: 'Peruvian Sol', flag: '🇵🇪', region: 'Americas', phoneCode: '+51' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', currencyName: 'Philippine Peso', flag: '🇵🇭', region: 'Asia', phoneCode: '+63' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', currencyName: 'Pakistani Rupee', flag: '🇵🇰', region: 'Asia', phoneCode: '+92' },
  { code: 'PL', name: 'Poland', currency: 'PLN', currencyName: 'Polish Zloty', flag: '🇵🇱', region: 'Europe', phoneCode: '+48' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', currencyName: 'Qatari Riyal', flag: '🇶🇦', region: 'Middle East', phoneCode: '+974' },
  { code: 'RO', name: 'Romania', currency: 'RON', currencyName: 'Romanian Leu', flag: '🇷🇴', region: 'Europe', phoneCode: '+40' },
  { code: 'RU', name: 'Russia', currency: 'RUB', currencyName: 'Russian Ruble', flag: '🇷🇺', region: 'Europe', phoneCode: '+7' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', currencyName: 'Saudi Riyal', flag: '🇸🇦', region: 'Middle East', phoneCode: '+966' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', currencyName: 'Swedish Krona', flag: '🇸🇪', region: 'Europe', phoneCode: '+46' },
  { code: 'TH', name: 'Thailand', currency: 'THB', currencyName: 'Thai Baht', flag: '🇹🇭', region: 'Asia', phoneCode: '+66' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', currencyName: 'Turkish Lira', flag: '🇹🇷', region: 'Europe', phoneCode: '+90' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', currencyName: 'Taiwan Dollar', flag: '🇹🇼', region: 'Asia', phoneCode: '+886' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', currencyName: 'Tanzanian Shilling', flag: '🇹🇿', region: 'Africa', phoneCode: '+255' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', currencyName: 'Ukrainian Hryvnia', flag: '🇺🇦', region: 'Europe', phoneCode: '+380' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', currencyName: 'Ugandan Shilling', flag: '🇺🇬', region: 'Africa', phoneCode: '+256' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', currencyName: 'Uruguayan Peso', flag: '🇺🇾', region: 'Americas', phoneCode: '+598' },
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', currencyName: 'Uzbekistani Som', flag: '🇺🇿', region: 'Asia', phoneCode: '+998' },
  { code: 'VE', name: 'Venezuela', currency: 'VES', currencyName: 'Venezuelan Bolívar', flag: '🇻🇪', region: 'Americas', phoneCode: '+58' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', currencyName: 'Vietnamese Dong', flag: '🇻🇳', region: 'Asia', phoneCode: '+84' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', currencyName: 'South African Rand', flag: '🇿🇦', region: 'Africa', phoneCode: '+27' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', currencyName: 'Zambian Kwacha', flag: '🇿🇲', region: 'Africa', phoneCode: '+260' },
];

export function getCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function getCurrencyByCountryCode(code: string): string {
  const country = getCountryByCode(code);
  return country?.currency || 'USD';
}

export function getCountryName(code: string): string {
  const country = getCountryByCode(code);
  return country?.name || code;
}

/**
 * Get the region for a country code. Used to determine locale formatting.
 */
export function getCountryRegion(code: string): string {
  const country = getCountryByCode(code);
  return country?.region || 'Americas';
}

/**
 * Returns true if the country is in Europe (for EUR display preference).
 */
export function isEuropeanCountry(code: string): boolean {
  const region = getCountryRegion(code);
  return region === 'Europe';
}

/**
 * Get the locale string for a country code (for Intl.NumberFormat).
 */
export function getCountryLocale(code: string): string {
  const localeMap: Record<string, string> = {
    US: 'en-US', GB: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT',
    ES: 'es-ES', NL: 'nl-NL', JP: 'ja-JP', CN: 'zh-CN', KR: 'ko-KR',
    BR: 'pt-BR', RU: 'ru-RU', SA: 'ar-SA', AE: 'ar-AE', IN: 'en-IN',
    SG: 'en-SG', HK: 'en-HK', CH: 'de-CH', SE: 'sv-SE', NO: 'nb-NO',
    DK: 'da-DK', PL: 'pl-PL', TR: 'tr-TR', ZA: 'en-ZA', AU: 'en-AU',
    CA: 'en-CA', MX: 'es-MX', AR: 'es-AR', EG: 'ar-EG', NG: 'en-NG',
    KE: 'en-KE', GH: 'en-GH', TH: 'th-TH', VN: 'vi-VN', ID: 'id-ID',
    MY: 'ms-MY', PH: 'en-PH', NZ: 'en-NZ', IL: 'he-IL',
  };
  return localeMap[code] || 'en-US';
}

/**
 * Format an amount in the user's local format based on their country code.
 * For European users, this uses the European number format (1.234,56 €).
 */
export function formatLocalAmount(
  amount: number,
  countryCode: string,
  currency: string
): string {
  const locale = getCountryLocale(countryCode);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency isn't supported by Intl
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CHF: 'Fr', SGD: 'S$',
  AED: 'د.إ', AFN: '؋', ALL: 'L', AMD: '֏', ANG: 'ƒ', AOA: 'Kz',
  ARS: '$', AUD: 'A$', AWG: 'ƒ', AZN: '₼', BAM: 'KM', BBD: '$',
  BDT: '৳', BGN: 'лв', BHD: '.د.ب', BIF: 'FBu', BMD: '$', BND: '$',
  BOB: 'Bs.', BRL: 'R$', BSD: '$', BTN: 'Nu.', BWP: 'P', BYN: 'Br',
  BZD: '$', CAD: 'C$', CDF: 'FC', CLP: '$', CNY: '¥', COP: '$',
  CRC: '₡', CUP: '$', CVE: '$', CZK: 'Kč', DJF: 'Fdj', DKK: 'kr',
  DOP: '$', DZD: 'د.ج', EGP: '£', ERN: 'Nfk', ETB: 'Br', FJD: '$',
  FKP: '£', GEL: '₾', GHS: '₵', GIP: '£', GMD: 'D', GNF: 'FG',
  GTQ: 'Q', GYD: '$', HKD: 'HK$', HNL: 'L', HRK: 'kn', HTG: 'G',
  HUF: 'Ft', IDR: 'Rp', ILS: '₪', INR: '₹', IQD: 'ع.د', IRR: '﷼',
  ISK: 'kr', JMD: '$', JOD: 'د.ا', KES: 'KSh', KGS: 'сом', KHR: '៛',
  KMF: 'CF', KPW: '₩', KRW: '₩', KWD: 'د.ك', KYD: '$', KZT: '₸',
  LAK: '₭', LBP: 'ل.ل', LKR: 'Rs', LRD: '$', LSL: 'L', LYD: 'ل.د',
  MAD: 'د.م.', MDL: 'L', MGA: 'Ar', MKD: 'ден', MMK: 'Ks', MNT: '₮',
  MOP: 'MOP$', MRU: 'UM', MUR: '₨', MVR: '.ރ', MWK: 'MK', MXN: '$',
  MYR: 'RM', MZN: 'MT', NAD: '$', NGN: '₦', NIO: 'C$', NOK: 'kr',
  NPR: '₨', NZD: 'NZ$', OMR: 'ر.ع.', PAB: 'B/.', PEN: 'S/', PGK: 'K',
  PHP: '₱', PKR: '₨', PLN: 'zł', PYG: '₲', QAR: 'ر.ق', RON: 'lei',
  RSD: 'дин', RUB: '₽', RWF: 'FRw', SAR: '﷼', SBD: '$', SCR: '₨',
  SDG: 'ج.س.', SEK: 'kr', SHP: '£', SLE: 'Le', SOS: 'Sh', SRD: '$',
  SSP: '£', STN: 'Db', SVC: '$', SYP: '£', SZL: 'E', THB: '฿',
  TJS: 'ЅМ', TMT: 'm', TND: 'د.ت', TOP: 'T$', TRY: '₺', TTD: '$',
  TWD: 'NT$', TZS: 'TSh', UAH: '₴', UGX: 'USh', UYU: '$', UZS: 'сўм',
  VES: 'Bs.', VND: '₫', VUV: 'VT', WST: 'T', XAF: 'FCFA', XCD: '$',
  XOF: 'CFA', XPF: '₣', YER: '﷼', ZAR: 'R', ZMW: 'ZK', ZWL: '$',
};