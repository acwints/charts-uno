import type { MapScope } from '@epic-charts/shared';

// TopoJSON topology type (simplified)
interface Topology {
  type: 'Topology';
  objects: Record<string, unknown>;
  arcs: number[][][];
}

// Cache for loaded geo data
const geoCache: { [key in MapScope]?: Topology } = {};

// US state FIPS codes to 2-letter abbreviations
export const US_STATE_FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR',
};

// Reverse lookup: abbreviation to FIPS
export const US_STATE_ABBREV_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_FIPS).map(([fips, abbrev]) => [abbrev, fips])
);

// ISO 3166-1 numeric to alpha-3 codes (subset of common countries)
export const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  '004': 'AFG', '008': 'ALB', '012': 'DZA', '020': 'AND', '024': 'AGO',
  '032': 'ARG', '036': 'AUS', '040': 'AUT', '048': 'BHR', '050': 'BGD',
  '056': 'BEL', '068': 'BOL', '076': 'BRA', '100': 'BGR', '104': 'MMR',
  '116': 'KHM', '124': 'CAN', '152': 'CHL', '156': 'CHN', '170': 'COL',
  '180': 'COD', '188': 'CRI', '192': 'CUB', '196': 'CYP', '203': 'CZE',
  '208': 'DNK', '214': 'DOM', '218': 'ECU', '818': 'EGY', '222': 'SLV',
  '231': 'ETH', '233': 'EST', '246': 'FIN', '250': 'FRA', '276': 'DEU',
  '288': 'GHA', '300': 'GRC', '320': 'GTM', '332': 'HTI', '340': 'HND',
  '348': 'HUN', '352': 'ISL', '356': 'IND', '360': 'IDN', '364': 'IRN',
  '368': 'IRQ', '372': 'IRL', '376': 'ISR', '380': 'ITA', '388': 'JAM',
  '392': 'JPN', '398': 'KAZ', '400': 'JOR', '404': 'KEN', '408': 'PRK',
  '410': 'KOR', '414': 'KWT', '422': 'LBN', '428': 'LVA', '434': 'LBY',
  '440': 'LTU', '442': 'LUX', '458': 'MYS', '484': 'MEX', '504': 'MAR',
  '508': 'MOZ', '528': 'NLD', '554': 'NZL', '558': 'NIC', '566': 'NGA',
  '578': 'NOR', '586': 'PAK', '591': 'PAN', '600': 'PRY', '604': 'PER',
  '608': 'PHL', '616': 'POL', '620': 'PRT', '630': 'PRI', '634': 'QAT',
  '642': 'ROU', '643': 'RUS', '682': 'SAU', '688': 'SRB', '702': 'SGP',
  '703': 'SVK', '704': 'VNM', '705': 'SVN', '710': 'ZAF', '724': 'ESP',
  '736': 'SDN', '752': 'SWE', '756': 'CHE', '760': 'SYR', '764': 'THA',
  '792': 'TUR', '804': 'UKR', '784': 'ARE', '826': 'GBR', '840': 'USA',
  '854': 'BFA', '858': 'URY', '860': 'UZB', '862': 'VEN', '887': 'YEM',
  '894': 'ZMB', '716': 'ZWE', '242': 'FJI', '834': 'TZA', '732': 'ESH',
};

// Reverse lookup: alpha-3 to numeric
export const ISO_ALPHA3_TO_NUMERIC: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_NUMERIC_TO_ALPHA3).map(([num, alpha]) => [alpha, num])
);

// State name to abbreviation
export const US_STATE_NAMES: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
  'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
  'Pennsylvania': 'PA', 'Puerto Rico': 'PR', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

// Common country name variations to ISO alpha-3
export const COUNTRY_NAME_TO_ALPHA3: Record<string, string> = {
  'United States': 'USA', 'United States of America': 'USA', 'US': 'USA', 'America': 'USA',
  'United Kingdom': 'GBR', 'UK': 'GBR', 'Great Britain': 'GBR', 'Britain': 'GBR', 'England': 'GBR',
  'China': 'CHN', "People's Republic of China": 'CHN',
  'Russia': 'RUS', 'Russian Federation': 'RUS',
  'Germany': 'DEU', 'Deutschland': 'DEU',
  'France': 'FRA',
  'Japan': 'JPN',
  'India': 'IND',
  'Brazil': 'BRA',
  'Canada': 'CAN',
  'Australia': 'AUS',
  'Mexico': 'MEX',
  'South Korea': 'KOR', 'Korea': 'KOR', 'Republic of Korea': 'KOR',
  'North Korea': 'PRK',
  'Italy': 'ITA',
  'Spain': 'ESP',
  'Netherlands': 'NLD', 'Holland': 'NLD',
  'Turkey': 'TUR', 'Turkiye': 'TUR',
  'Saudi Arabia': 'SAU',
  'Switzerland': 'CHE',
  'Poland': 'POL',
  'Sweden': 'SWE',
  'Belgium': 'BEL',
  'Argentina': 'ARG',
  'South Africa': 'ZAF',
  'Nigeria': 'NGA',
  'Egypt': 'EGY',
  'Indonesia': 'IDN',
  'Vietnam': 'VNM', 'Viet Nam': 'VNM',
  'Thailand': 'THA',
  'Philippines': 'PHL',
  'Malaysia': 'MYS',
  'Singapore': 'SGP',
  'Pakistan': 'PAK',
  'Bangladesh': 'BGD',
  'Iran': 'IRN',
  'Iraq': 'IRQ',
  'Israel': 'ISR',
  'UAE': 'ARE', 'United Arab Emirates': 'ARE',
};

/**
 * Lazy-load geo data for a given scope
 */
export async function loadGeoData(scope: MapScope): Promise<Topology> {
  if (geoCache[scope]) {
    return geoCache[scope]!;
  }

  const url = scope === 'us-states'
    ? '/geo/us-states.json'
    : '/geo/world-countries.json';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load geo data: ${response.statusText}`);
  }

  const data = await response.json() as Topology;
  geoCache[scope] = data;
  return data;
}

/**
 * Get the object key for geometries in the TopoJSON
 */
export function getGeoObjectKey(scope: MapScope): string {
  return scope === 'us-states' ? 'states' : 'countries';
}

/**
 * Look up a region's TopoJSON ID from its user-facing ID
 * For US states: convert abbreviation (CA) to FIPS (06)
 * For world: convert alpha-3 (USA) to numeric (840)
 */
export function getGeoId(scope: MapScope, regionId: string): string | undefined {
  if (scope === 'us-states') {
    // If it's already a FIPS code, return it
    if (US_STATE_FIPS[regionId]) {
      return regionId;
    }
    // Convert abbreviation to FIPS
    return US_STATE_ABBREV_TO_FIPS[regionId.toUpperCase()];
  } else {
    // If it's already a numeric code, return it
    if (ISO_NUMERIC_TO_ALPHA3[regionId]) {
      return regionId;
    }
    // Convert alpha-3 to numeric
    return ISO_ALPHA3_TO_NUMERIC[regionId.toUpperCase()];
  }
}

/**
 * Parse a region identifier (name, abbreviation, or code) into a normalized ID
 */
export function normalizeRegionId(scope: MapScope, input: string): string | undefined {
  const trimmed = input.trim();

  if (scope === 'us-states') {
    // Try as abbreviation first
    if (trimmed.length === 2 && US_STATE_ABBREV_TO_FIPS[trimmed.toUpperCase()]) {
      return trimmed.toUpperCase();
    }
    // Try as full name
    const abbrev = US_STATE_NAMES[trimmed];
    if (abbrev) return abbrev;
    // Try case-insensitive name lookup
    const lowerInput = trimmed.toLowerCase();
    for (const [name, ab] of Object.entries(US_STATE_NAMES)) {
      if (name.toLowerCase() === lowerInput) return ab;
    }
  } else {
    // Try as alpha-3 code
    if (trimmed.length === 3 && ISO_ALPHA3_TO_NUMERIC[trimmed.toUpperCase()]) {
      return trimmed.toUpperCase();
    }
    // Try as country name
    const alpha3 = COUNTRY_NAME_TO_ALPHA3[trimmed];
    if (alpha3) return alpha3;
    // Try case-insensitive name lookup
    const lowerInput = trimmed.toLowerCase();
    for (const [name, code] of Object.entries(COUNTRY_NAME_TO_ALPHA3)) {
      if (name.toLowerCase() === lowerInput) return code;
    }
  }

  return undefined;
}
