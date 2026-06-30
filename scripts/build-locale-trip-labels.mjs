import { readFileSync, writeFileSync } from 'node:fs';
import { TRIP_DESTINATIONS } from '../src/lib/trip-destination-data.ts';

const EN_COUNTRIES = {
  japan: 'Japan',
  korea: 'South Korea',
  china: 'China',
  canada: 'Canada',
  south_africa: 'South Africa',
  germany: 'Germany',
  spain: 'Spain',
  italy: 'Italy',
  france: 'France',
  uk: 'United Kingdom',
  usa: 'United States',
  portugal: 'Portugal',
  belgium: 'Belgium',
  netherlands: 'Netherlands',
  czech: 'Czech Republic',
  poland: 'Poland',
  austria: 'Austria',
  sweden: 'Sweden',
  russia: 'Russia',
  hungary: 'Hungary',
  switzerland: 'Switzerland',
};

const EN_CITIES = {
  japan: { tokyo: 'Tokyo', kyoto: 'Kyoto', osaka: 'Osaka', okinawa: 'Okinawa Islands', hokkaido: 'Hokkaido' },
  korea: { seoul: 'Seoul', busan: 'Busan', jeju: 'Jeju Island' },
  china: { beijing: 'Beijing', shanghai: 'Shanghai', guangzhou: 'Guangzhou' },
  canada: { toronto: 'Toronto', vancouver: 'Vancouver', montreal: 'Montreal' },
  south_africa: { cape_town: 'Cape Town', johannesburg: 'Johannesburg' },
  germany: { berlin: 'Berlin', munich: 'Munich', frankfurt: 'Frankfurt' },
  spain: { madrid: 'Madrid', barcelona: 'Barcelona', malaga: 'Málaga / Andalusia' },
  italy: { rome: 'Rome', milan: 'Milan', venice: 'Venice', florence: 'Florence' },
  france: { paris: 'Paris', nice: 'Nice', cannes: 'Cannes' },
  uk: { london: 'London', edinburgh: 'Edinburgh', manchester: 'Manchester' },
  usa: { new_york: 'New York', los_angeles: 'Los Angeles', miami: 'Miami', orlando: 'Orlando' },
  portugal: { lisbon: 'Lisbon', porto: 'Porto', algarve: 'Algarve', azores: 'Azores', madeira: 'Madeira' },
  belgium: { brussels: 'Brussels', bruges: 'Bruges' },
  netherlands: { amsterdam: 'Amsterdam', rotterdam: 'Rotterdam', hague: 'The Hague' },
  czech: { prague: 'Prague', karlovy_vary: 'Karlovy Vary' },
  poland: { warsaw: 'Warsaw', krakow: 'Krakow' },
  austria: { vienna: 'Vienna', salzburg: 'Salzburg', zell_am_see: 'Zell am See' },
  sweden: { stockholm: 'Stockholm', gothenburg: 'Gothenburg' },
  russia: { moscow: 'Moscow', saint_petersburg: 'Saint Petersburg' },
  hungary: { budapest: 'Budapest' },
  switzerland: { geneva: 'Geneva', interlaken: 'Interlaken', zermatt: 'Zermatt' },
};

const arCountries = {};
const arCities = {};
for (const c of TRIP_DESTINATIONS) {
  arCountries[c.id] = c.labelAr;
  arCities[c.id] = {};
  for (const city of c.cities) arCities[c.id][city.id] = city.labelAr;
}

const patch = (file, tripLabels) => {
  const path = `src/locales/${file}`;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  data.tripLabels = tripLabels;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

patch('ar.json', { countries: arCountries, cities: arCities });
patch('en.json', { countries: EN_COUNTRIES, cities: EN_CITIES });
console.log('tripLabels patched');
