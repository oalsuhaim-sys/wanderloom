import type { TripCountryId } from '@/lib/trip-destination-data';

import type { SeasonKey } from './destination-advisor-data';

/** [advice, event, activities] — English copy mirroring the Arabic advisor data season by season. */
export type SeasonCopyEn = [string, string, [string, string]];

export type CountryCopyEn = {
  name: string;
  refCity: string;
  seasons: Record<SeasonKey, SeasonCopyEn>;
};

export const COUNTRIES_EN: Partial<Record<TripCountryId, CountryCopyEn>> = {
  japan: {
    name: 'Japan',
    refCity: 'Tokyo',
    seasons: {
      spring: [
        'One of Japan’s finest seasons: cherry blossoms usually open in Tokyo and Kyoto from late March to early April, and the weather is mild for exploring. Hotels fill up early for those weeks, so we book months ahead.',
        'Night-time sakura (yozakura), when the trees are lit after dark in Kyoto’s Maruyama Park and along Tokyo’s Meguro River.',
        ['A hanami picnic in Shinjuku Gyoen', 'Kiyomizu-dera early in the morning, before the crowds'],
      ],
      summer: [
        'The rainy season (tsuyu) runs from early June to mid-July, followed by strong heat and humidity in Tokyo and Kyoto. If summer is your only window, Hokkaido in the north is much cooler and gentler.',
        'Kyoto’s Gion Matsuri throughout July, and the Sumida River fireworks in Tokyo on the last Saturday of July.',
        ['Lavender fields in Furano, Hokkaido (July)', 'Summer festival evenings in a yukata'],
      ],
      autumn: [
        'Dry, comfortable weather, with autumn colours (koyo) peaking in Kyoto and Tokyo from about mid-November to early December. September can bring the tail of typhoons, so October and November are best.',
        'Kyoto’s Jidai Matsuri on 22 October: a procession in costumes from each era of Japanese history.',
        ['Night-time autumn illuminations at Kyoto temples', 'Lake Kawaguchi and Mount Fuji in autumn colours'],
      ],
      winter: [
        'Tokyo’s skies are mostly clear and dry, and Hokkaido’s snow is among the best in the world for skiing. A great season for onsen lovers and quiet travel, apart from the New Year holiday crowds.',
        'The Sapporo Snow Festival in early February: huge snow and ice sculptures lit up at night.',
        ['Skiing in Niseko', 'An open-air onsen in the snow at a traditional ryokan'],
      ],
    },
  },
  korea: {
    name: 'South Korea',
    refCity: 'Seoul',
    seasons: {
      spring: [
        'One of Korea’s best times: cherry blossoms open in Busan and Seoul around early April, and the weather is mild for walking. Some spring days bring yellow dust, so we keep the plan flexible around them.',
        'The Jinhae Gunhangje Festival near Busan in early April — Korea’s largest cherry blossom festival.',
        ['Gyeongbokgung Palace in traditional hanbok', 'The cherry blossom walk on Yeouido, Seoul'],
      ],
      summer: [
        'The monsoon (jangma) runs roughly from late June to late July, followed by high heat and humidity in August. We don’t recommend it for long city tours; if you travel, make Jeju and the coast the focus.',
        'The Boryeong Mud Festival on the west coast in July.',
        ['Haeundae and Gwangalli beaches in Busan', 'Waterfalls and coastal trails on Jeju Island'],
      ],
      autumn: [
        'Korea’s best season: clear skies and crisp air. Autumn colours peak on Seoraksan in Gangwon around mid-October, then in Seoul in late October and early November.',
        'The Busan International Film Festival in October, and the Seoul Lantern Festival on Cheonggyecheon Stream in November.',
        ['The Seoraksan cable car through autumn colours', 'Bukchon Hanok Village'],
      ],
      winter: [
        'Cold, dry winters with snow in Gangwon — ideal for skiers and cosy markets. We choose stays close to the metro to keep walks in the cold short.',
        'The Hwacheon Ice Festival in January, where people fish through holes in the frozen river.',
        ['Skiing at the Pyeongchang resorts (Yongpyong and Alpensia)', 'A luxury Korean spa (jjimjilbang)'],
      ],
    },
  },
  china: {
    name: 'China',
    refCity: 'Shanghai',
    seasons: {
      spring: [
        'Shanghai’s spring is mild and good for strolling between the Bund and the classical gardens. Guangzhou warms up and turns humid early, and the April Canton Fair pushes its hotel prices up.',
        'The spring Canton Fair in Guangzhou (April – May), and peach and cherry blossoms in Shanghai’s gardens.',
        ['Yuyuan Garden and Shanghai’s Old Town', 'A day trip to the water town of Zhouzhuang or to Suzhou'],
      ],
      summer: [
        'Summer starts with the plum rains (meiyu) in June, followed by intense heat and humidity and possible typhoons on the southern coast. We only recommend short visits with a mostly indoor plan.',
        'The Dragon Boat Festival, usually in June depending on the lunar calendar.',
        ['Fine dining in Shanghai', 'Night views of the Bund from the rooftops'],
      ],
      autumn: [
        'China’s best season: dry, mild weather and clearer skies. Avoid National Day week (1–7 October), when sights and trains get extremely crowded.',
        'The Mid-Autumn (Moon) Festival in September or early October, with lanterns and mooncakes.',
        ['A night cruise on the Huangpu River', 'Cantonese cuisine in Guangzhou'],
      ],
      winter: [
        'Shanghai’s winter is cold and damp but quiet and better value, while Guangzhou is mild and pleasant. Avoid Chinese New Year week (January or February), when the whole country travels.',
        'The Lantern Festival at Shanghai’s Yuyuan Garden around Chinese New Year.',
        ['Luxury shopping in Xintiandi and on Nanjing Road', 'Cantonese dim sum in Guangzhou'],
      ],
    },
  },
  indonesia: {
    name: 'Indonesia',
    refCity: 'Bali',
    seasons: {
      winter: [
        'Peak rainy season in Bali: heavy showers and high humidity, plus the New Year crowds. A private villa with a pool keeps the stay enjoyable even when it rains.',
        'The Hindu celebrations of Galungan and Kuningan, which come round every 210 days on the Balinese calendar.',
        ['A private pool villa in Ubud', 'Traditional Balinese spa sessions'],
      ],
      spring: [
        'The rains ease through March, and April and May are among the loveliest months: lush green, sunny weather and fewer crowds.',
        'Nyepi, the Day of Silence, in March: the whole island stops for 24 hours and the airport closes, after a parade of giant ogoh-ogoh effigies.',
        ['The Tegallalang rice terraces', 'Ulun Danu Beratan temple on the lake'],
      ],
      summer: [
        'Dry season and Bali’s best weather, but also the busiest time — especially July and August — so early booking is essential.',
        'The Bali Arts Festival in Denpasar (June – July).',
        ['Sunset at Uluwatu temple and the kecak dance', 'A private yacht to the Nusa islands'],
      ],
      autumn: [
        'September and October are excellent: still dry, with lighter crowds. The rains return gradually in November.',
        'The Ubud Writers & Readers Festival (October).',
        ['Sunrise from Mount Batur', 'Sunset on Jimbaran’s beaches'],
      ],
    },
  },
  france: {
    name: 'France',
    refCity: 'Paris',
    seasons: {
      spring: [
        'Paris at its most beautiful: trees in bloom, gardens coming back to life and fewer crowds than summer. March is changeable; May is the loveliest.',
        'The Roland-Garros tennis tournament in Paris, from late May to early June.',
        ['A stroll through the Tuileries and Luxembourg gardens', 'The Palace of Versailles and its gardens'],
      ],
      summer: [
        'Peak season: long days and warm weather, with Lake Annecy at its best. Paris is busy in July and some restaurants close in August, so we reserve tables in advance.',
        'Bastille Day on 14 July: the Champs-Élysées parade and fireworks at the Eiffel Tower.',
        ['A private boat on Lake Annecy', 'Dinner on the Seine at sunset'],
      ],
      autumn: [
        'September and October are among the best times: mild weather, fewer crowds and Paris’s cultural season in full swing. November is colder and wetter.',
        'Paris Fashion Week (late September – early October).',
        ['The Louvre and Musée d’Orsay with a private guide', 'Strasbourg and the colourful villages of Alsace'],
      ],
      winter: [
        'Mostly cold and grey, but December is magical with the Champs-Élysées lights and Christmas markets. January and February are the quietest months, ideal for museums and shopping.',
        'The Strasbourg Christmas Market (late November – December), one of Europe’s oldest and most famous.',
        ['The Champs-Élysées lights and Galeries Lafayette', 'Shopping on Avenue Montaigne and Faubourg Saint-Honoré'],
      ],
    },
  },
  uk: {
    name: 'United Kingdom',
    refCity: 'London',
    seasons: {
      spring: [
        'The royal parks bloom and the weather improves gradually, with passing showers. April and May are ideal before the summer crowds.',
        'The Chelsea Flower Show in London (May).',
        ['Kew Gardens', 'Afternoon tea at one of London’s historic hotels'],
      ],
      summer: [
        'The best time for the UK: long days, mild warmth and the Scottish Highlands season. It’s peak season for Gulf travellers, so early hotel booking is essential.',
        'Wimbledon (late June – July) and the Edinburgh Festival in August.',
        ['The Scottish Highlands and Loch Ness', 'Shopping in Knightsbridge and on Bond Street'],
      ],
      autumn: [
        'September and early October are pleasant and calmer than summer, with Scotland’s forests and London’s parks changing colour. November is colder and wetter.',
        'Frieze contemporary art fair in Regent’s Park (October).',
        ['West End theatre', 'Edinburgh Castle and the Old Town'],
      ],
      winter: [
        'Short days and cold, rainy weather in January and February. The exception is December, when London’s lights and festive atmosphere are worth the trip.',
        'Winter Wonderland in Hyde Park (late November – early January) and Hogmanay New Year celebrations in Edinburgh.',
        ['The lights on Regent Street and Oxford Street', 'Shopping at Harrods'],
      ],
    },
  },
  germany: {
    name: 'Germany',
    refCity: 'Munich',
    seasons: {
      spring: [
        'A mild spring when gardens bloom and Rhine cruises begin. May is the loveliest time for Neuschwanstein Castle near Füssen.',
        'The start of the Rhine cruise season past the castles of the UNESCO-listed Middle Rhine Valley.',
        ['Neuschwanstein Castle and Lake Alpsee near Füssen', 'Cologne Cathedral and the Old Town'],
      ],
      summer: [
        'A warm, mild summer, ideal for the Bavarian Alps and lakes. Short heatwaves are possible in July and August.',
        'Munich’s Tollwood Summer Festival (June – July), with art and markets.',
        ['The Zugspitze, Germany’s highest peak, near Garmisch', 'Lake Königssee in Berchtesgaden'],
      ],
      autumn: [
        'Late September and October are beautiful, with the colours of the Black Forest and Bavaria. Munich gets crowded and hotel prices rise during Oktoberfest (late September – early October), so we plan around it.',
        'Christmas markets open in late November in Cologne, Munich and Nuremberg.',
        ['The Black Forest and Baden-Baden', 'The Romantic Road and the town of Rothenburg'],
      ],
      winter: [
        'December is the star of the German winter, with Christmas markets in every city; January and February are for skiing in the Bavarian Alps.',
        'The Christmas market in front of Cologne Cathedral, and the Marienplatz market in Munich (until about 24 December).',
        ['Skiing in Garmisch-Partenkirchen', 'Neuschwanstein under the snow'],
      ],
    },
  },
  spain: {
    name: 'Spain',
    refCity: 'Madrid',
    seasons: {
      spring: [
        'One of Spain’s best seasons: mild weather in Madrid and Andalusia, with orange trees in blossom in Granada and Málaga.',
        'Holy Week in Málaga and the April Fair in Seville (dates move with Easter).',
        ['The Alhambra and the Generalife gardens in Granada', 'The Prado and Retiro Park in Madrid'],
      ],
      summer: [
        'Beach season par excellence in Marbella and Palma. Madrid and Granada get very hot and can pass 38°C, so we keep visits there to the mornings and spend the rest of the day on the coast.',
        'The Copa del Rey sailing regatta in Palma (late July – early August).',
        ['A private yacht around Mallorca', 'Puerto Banús and Marbella’s beaches'],
      ],
      autumn: [
        'September and October are excellent: the sea is still warm, and the cities are cooler and less crowded.',
        'Barcelona’s La Mercè festival (late September), with human towers and fireworks.',
        ['Sagrada Família and Park Güell in Barcelona', 'The white villages of Andalusia with a private driver'],
      ],
      winter: [
        'A mild winter in Andalusia and the Balearics compared with the rest of Europe; Madrid is cold but usually sunny. A quiet time for museums and restaurants.',
        'The Three Kings parade on the evening of 5 January in Madrid and cities across Spain.',
        ['Madrid’s markets and restaurants', 'Winter sunshine in Málaga on the Costa del Sol'],
      ],
    },
  },
  italy: {
    name: 'Italy',
    refCity: 'Rome',
    seasons: {
      spring: [
        'The best time for Rome and Florence: mild weather and flowers everywhere before the summer heat and crowds. Easter is busy, so we book early.',
        'The Scoppio del Carro (Explosion of the Cart) outside Florence Cathedral on Easter Sunday morning.',
        ['The Vatican and the Colosseum on an early private tour', 'The Tuscan countryside and Val d’Orcia'],
      ],
      summer: [
        'Rome and Florence are hot and crowded in July and August, but the north is at its best: Lake Como and the Dolomites are refreshing. We steer summer trips north and to the coast.',
        'The historic Palio horse race in Siena on 2 July and 16 August.',
        ['A private boat on Lake Como between Bellagio and Varenna', 'The Amalfi Coast and Capri'],
      ],
      autumn: [
        'September and October are among the loveliest months: the sea is still warm, the cities are gentler, and white truffle season begins in Piedmont.',
        'The International White Truffle Fair in Alba (October – early December).',
        ['Truffle tasting in the Langhe hills', 'Shopping in Milan’s fashion district'],
      ],
      winter: [
        'Rome’s winter is mild and the quietest time for museums; the north is for skiing in Cortina d’Ampezzo, host of the 2026 Winter Olympics.',
        'The Venice Carnival with its historic masks (usually February).',
        ['Skiing in Cortina and the Dolomites', 'The Vatican Museums with fewer crowds'],
      ],
    },
  },
  switzerland: {
    name: 'Switzerland',
    refCity: 'Interlaken',
    seasons: {
      spring: [
        'Spring is changeable: the valleys turn green while the peaks stay snowy, and some cable cars close for maintenance in April. Late May is the loveliest.',
        'The Lauterbrunnen Valley waterfalls at their most powerful as the snow melts.',
        ['A boat trip on Lakes Thun and Brienz', 'The GoldenPass panoramic train'],
      ],
      summer: [
        'Switzerland’s golden season: mountain trails open, turquoise lakes and mild weather. The most requested season, so we book hotels with a view early.',
        'Swiss National Day on 1 August, with fireworks and bonfires on the peaks.',
        ['The Jungfraujoch train to the “Top of Europe”', 'The First cable car and Cliff Walk'],
      ],
      autumn: [
        'September and early October are wonderful: clear skies, autumn colours and fewer crowds. November is grey and some mountain facilities close for maintenance.',
        'The cattle descent from the Alpine pastures in September, with the cows in traditional festive decorations.',
        ['Lucerne and Mount Pilatus', 'Fondue and cheese in the valley villages'],
      ],
      winter: [
        'Ski season runs from December to March, with the Alpine villages under snow. The cold in Interlaken is much milder than on the peaks.',
        'The Lauberhorn race in Wengen (January), the longest downhill on the Ski World Cup.',
        ['Skiing in Grindelwald and Wengen', 'Sledging down the First trails'],
      ],
    },
  },
  portugal: {
    name: 'Portugal',
    refCity: 'Lisbon',
    seasons: {
      spring: [
        'A warm, sunny spring in Lisbon and the Algarve, ideal for exploring before the summer heat.',
        'The Madeira Flower Festival (April – May).',
        ['Pena Palace in Sintra', 'Lisbon’s Alfama and Belém districts'],
      ],
      summer: [
        'Beach season in the Algarve and Cascais, with Lisbon’s sunshine softened by Atlantic breezes. August is the busiest month.',
        'The Santo António festivities in Lisbon’s old quarters on the night of 12 June.',
        ['A private yacht to the Benagil caves in the Algarve', 'The Cascais coast'],
      ],
      autumn: [
        'September and October are excellent: a warm sea, fewer crowds and the grape harvest in the Douro Valley.',
        'Harvest season in the Douro Valley (September), with its golden terraces.',
        ['A river cruise in the Douro Valley', 'Old Porto'],
      ],
      winter: [
        'One of Europe’s warmest winter destinations; there is more rain but plenty of sunny days, and Madeira and the Algarve are milder than Lisbon.',
        'The New Year fireworks in Funchal, Madeira — among the largest in the world.',
        ['Sintra and Cascais with fewer crowds', 'The warm island of Madeira'],
      ],
    },
  },
  belgium: {
    name: 'Belgium',
    refCity: 'Brussels',
    seasons: {
      spring: [
        'A gentle spring, with the bluebell forest of Hallerbos in flower around late April.',
        'The Royal Greenhouses of Laeken, open to visitors for only about three weeks between April and May.',
        ['The Hallerbos bluebell forest', 'Bruges and its canals'],
      ],
      summer: [
        'The best season: long days and mild weather for exploring Bruges and Ghent, with a shower possible at any time.',
        'The Flower Carpet on Brussels’ Grand-Place in August, held every two years in even-numbered years.',
        ['A canal boat tour in Bruges', 'The Grand-Place and Brussels’ museums'],
      ],
      autumn: [
        'September and October are calm and good for cities and museums; the rain picks up in November.',
        'Heritage Days in Brussels (mid-September), when historic buildings usually closed to the public open their doors.',
        ['Luxury Belgian chocolate workshops', 'The city of Ghent and its castle'],
      ],
      winter: [
        'Cold, damp and short days — except December, when Brussels and Bruges are decorated with Christmas markets.',
        'The Winter Wonders festival in Brussels (late November – early January).',
        ['Christmas markets in Bruges', 'The cafés of the Royal Saint-Hubert Galleries'],
      ],
    },
  },
  netherlands: {
    name: 'Netherlands',
    refCity: 'Amsterdam',
    seasons: {
      spring: [
        'The world’s most famous flower season: tulip fields bloom from late March to early May, with April the peak.',
        'Keukenhof gardens (about mid-March – mid-May), and King’s Day on 27 April, when Amsterdam turns orange.',
        ['The tulip fields around Lisse', 'A private canal boat in Amsterdam'],
      ],
      summer: [
        'Mild warmth and long days, ideal for the canals and walking. Amsterdam is busy this season, so early booking is essential.',
        'The Grachtenfestival classical music festival on Amsterdam’s canals (August).',
        ['Zaanse Schans and its windmills', 'Rotterdam’s modern architecture'],
      ],
      autumn: [
        'September is pleasant, then rain and wind pick up. A good time for museums with fewer crowds.',
        'Dutch Design Week in Eindhoven (October).',
        ['The Rijksmuseum and the Van Gogh Museum', 'Markthal in Rotterdam'],
      ],
      winter: [
        'Cold, damp and short days; we recommend it only for a short city break, with the light festival season as the exception.',
        'The Amsterdam Light Festival (late November – January): light artworks along the canals.',
        ['An evening canal cruise past the light artworks', 'Amsterdam’s museums'],
      ],
    },
  },
  czech: {
    name: 'Czech Republic',
    refCity: 'Prague',
    seasons: {
      spring: [
        'Prague wakes up in bloom, and April and May are ideal for exploring before the summer crowds.',
        'The Prague Spring classical music festival (May – June).',
        ['Prague Castle and Charles Bridge in the morning', 'Petřín Hill and its view'],
      ],
      summer: [
        'Warm and sunny with occasional short thunderstorms — peak season in the Old Town.',
        'The Five-Petalled Rose Festival in Český Krumlov (June).',
        ['A day trip to Český Krumlov', 'A river cruise on the Vltava'],
      ],
      autumn: [
        'September and October are beautiful, with colourful gardens and fewer crowds.',
        'The Signal light festival in Prague (October).',
        ['The spa town of Karlovy Vary', 'The historic Strahov Monastery library'],
      ],
      winter: [
        'Cold, but December is magical with the Christmas markets, and January and February are the quietest months.',
        'The Old Town Square Christmas market (late November – early January).',
        ['Prague Castle under the snow', 'Classical concerts in historic halls'],
      ],
    },
  },
  poland: {
    name: 'Poland',
    refCity: 'Kraków',
    seasons: {
      spring: [
        'A fresh spring that warms up in May, with Kraków at its best before the summer crowds.',
        'The traditional Easter market on Kraków’s Main Market Square.',
        ['The Wieliczka Salt Mine', 'The Market Square and Wawel Castle in Kraków'],
      ],
      summer: [
        'Poland’s best time: mild warmth, green parks and open trails in the Tatra Mountains near Zakopane.',
        'Free Chopin concerts at his monument in Łazienki Park, Warsaw, every Sunday from May to September.',
        ['The Tatra Mountains and Zakopane', 'Warsaw’s Old Town'],
      ],
      autumn: [
        'September is warm and golden; October is cooler, with beautiful colours in the Tatras.',
        'The golden autumn in the Tatra Mountains (late September – October).',
        ['Wilanów Palace in Warsaw', 'A traditional Polish food tour in Kraków'],
      ],
      winter: [
        'Cold and sometimes snowy; December is lovely with Kraków’s markets, and Zakopane is for skiing.',
        'The Christmas market on Kraków’s Main Market Square.',
        ['The Wieliczka Salt Mine (a constant temperature all year)', 'Skiing in Zakopane'],
      ],
    },
  },
  austria: {
    name: 'Austria',
    refCity: 'Salzburg',
    seasons: {
      spring: [
        'A fresh spring in Salzburg and the Alpine valleys, with the peaks still snow-capped.',
        'The Salzburg Easter Festival of classical music.',
        ['The Mirabell Palace gardens in Salzburg', 'Hallstatt with fewer crowds'],
      ],
      summer: [
        'A mild summer, ideal for the lakes and Alpine villages, with the Salzkammergut at its best.',
        'The Salzburg Festival of music and theatre (late July – August).',
        ['Lake Wolfgang and the village of St. Wolfgang', 'The Skywalk viewing platform above Hallstatt'],
      ],
      autumn: [
        'September and October are calm, with autumn colours on the lakes; November is grey until the Christmas markets begin.',
        'Salzburg’s traditional Rupertikirtag festival (late September).',
        ['The Hallstatt salt mine', 'Old Salzburg and Mozart’s birthplace'],
      ],
      winter: [
        'Ski season in the Austrian Alps, Christmas markets in Salzburg and Vienna, and Vienna’s ball season between January and February.',
        'The famous Vienna Opera Ball (February).',
        ['Skiing in Kitzbühel or St. Anton', 'Hallstatt under the snow'],
      ],
    },
  },
  sweden: {
    name: 'Sweden',
    refCity: 'Stockholm',
    seasons: {
      spring: [
        'March and April are still cold in Stockholm; real spring starts in May, with long days and flowers.',
        'Walpurgis Night on 30 April, with bonfires at the Skansen open-air museum.',
        ['Djurgården island and the Vasa Museum', 'Stockholm’s Old Town (Gamla Stan)'],
      ],
      summer: [
        'Sweden’s most beautiful time: days of more than 18 hours in June and mild weather for exploring the Stockholm archipelago.',
        'Midsummer (Midsommar) in late June — Sweden’s most important celebration.',
        ['A private yacht in the Stockholm archipelago', 'Vaxholm island by boat'],
      ],
      autumn: [
        'September is pleasant with autumn colours, then the days shorten quickly in October and November.',
        'Northern lights season in Lapland starts in September, for those extending the trip north.',
        ['The Vasa Museum and ABBA The Museum', 'Forests and lakes around Stockholm'],
      ],
      winter: [
        'Stockholm’s days are very short (about 6 hours in December) and cold, but Lapland in the north is perfect for the northern lights and snow.',
        'The Icehotel in Jukkasjärvi (about December – April), and the Nobel Prize ceremony in Stockholm on 10 December.',
        ['The northern lights in Kiruna and Abisko', 'Husky sledding in Lapland'],
      ],
    },
  },
  russia: {
    name: 'Russia',
    refCity: 'Moscow',
    seasons: {
      spring: [
        'March and April are the season of melting snow and wet streets; May is the lovely exception.',
        'The Victory Day parade on Red Square on 9 May.',
        ['The Kremlin and Red Square', 'Zaryadye Park'],
      ],
      summer: [
        'Moscow’s best season: warm weather and long days, and you can add Saint Petersburg during the White Nights (June – early July).',
        'The Scarlet Sails festival in Saint Petersburg (late June).',
        ['A river cruise on the Moskva', 'Moscow’s historic metro stations'],
      ],
      autumn: [
        'September is Moscow’s golden autumn, then it cools quickly in October and November.',
        'The Circle of Light festival of projections on Moscow’s buildings, usually held in autumn.',
        ['Kolomenskoye Park in autumn colours', 'The Bolshoi Theatre'],
      ],
      winter: [
        'A snowy, very cold winter that can drop below -15°C, but the New Year celebrations light up Moscow. Best for snow lovers with heavy winter clothing.',
        'Maslenitsa folk festival week (late February or early March).',
        ['The ice rink on Red Square', 'New Year lights across Moscow'],
      ],
    },
  },
  hungary: {
    name: 'Hungary',
    refCity: 'Budapest',
    seasons: {
      spring: [
        'A gentle spring with gardens in bloom, and May is ideal for walking along the Danube.',
        'The Budapest Spring Festival of the arts (April).',
        ['A Danube river cruise', 'Buda Castle and the old quarter'],
      ],
      summer: [
        'Warm and sunny, with the outdoor thermal baths at their best.',
        'The Hungarian Formula 1 Grand Prix near Budapest (July or August).',
        ['The outdoor Széchenyi thermal bath', 'Margaret Island'],
      ],
      autumn: [
        'September and October are beautiful and mild, with fewer crowds.',
        'The CAFe Budapest Contemporary Arts Festival (October).',
        ['A tour inside the Hungarian Parliament', 'Fisherman’s Bastion at sunset'],
      ],
      winter: [
        'Cold, but warm thermal baths in the chill are unforgettable, and Christmas markets fill the city centre.',
        'The Christmas market on Vörösmarty Square and in front of St. Stephen’s Basilica.',
        ['The Gellért thermal bath', 'The ice rink in City Park'],
      ],
    },
  },
  usa: {
    name: 'United States',
    refCity: 'New York',
    seasons: {
      spring: [
        'Spring in New York and Washington is beautiful, with blossoms and mild weather; May is the loveliest.',
        'The National Cherry Blossom Festival in Washington (late March – early April).',
        ['Central Park and Fifth Avenue', 'The Metropolitan Museum of Art'],
      ],
      summer: [
        'Warm and humid in New York with occasional heatwaves — a perfect season for the West Coast and the national parks.',
        'The US Open tennis championships in New York (late August – September).',
        ['The Hamptons on Long Island', 'A helicopter tour over Manhattan'],
      ],
      autumn: [
        'The best time for New York and New England: crisp air and stunning autumn colours in October.',
        'The Macy’s Thanksgiving Day Parade in New York (November).',
        ['Autumn foliage in Vermont and New Hampshire', 'Broadway shows'],
      ],
      winter: [
        'Cold with occasional snow, but December is magical with the holiday lights. January and February are the coldest months, good for skiing in Colorado.',
        'The Rockefeller Center tree and holiday lights in New York (December).',
        ['Skiing in Aspen', 'Shopping on Madison Avenue'],
      ],
    },
  },
  canada: {
    name: 'Canada',
    refCity: 'Toronto',
    seasons: {
      spring: [
        'Spring comes late in Canada: Banff’s lakes stay frozen until late May or June, and the Moraine Lake road usually opens in June. May suits Toronto and Montréal only.',
        'The Canadian Tulip Festival in Ottawa (May).',
        ['Niagara Falls at the start of the season', 'Old Montréal'],
      ],
      summer: [
        'Canada’s best season: Banff’s turquoise lakes, with Vancouver and Whistler at their best. Rocky Mountain hotels need booking very early.',
        'The Calgary Stampede (July), close to Banff.',
        ['Moraine Lake and Lake Louise', 'A boat under Niagara Falls'],
      ],
      autumn: [
        'Late September and early October are peak autumn colours in Québec and Ontario, with golden larches in Banff.',
        'The Toronto International Film Festival (September).',
        ['Autumn colours in the Laurentian Mountains', 'Golden larch season in Banff'],
      ],
      winter: [
        'A harsh winter, but ideal for skiing in Whistler and Banff and for snow experiences in Québec.',
        'The Québec Winter Carnival (February).',
        ['Skiing at Whistler Blackcomb', 'The Ice Hotel in Québec'],
      ],
    },
  },
  south_africa: {
    name: 'South Africa',
    refCity: 'Cape Town',
    seasons: {
      summer: [
        'Summer here runs from December to February: Cape Town is sunny and dry, perfect for the beaches and Table Mountain, with a strong south-easterly wind at times.',
        'The Cape Town Minstrel Carnival (Tweede Nuwe Jaar) on 2 January.',
        ['The cable car to the top of Table Mountain', 'Boulders Beach and its penguins'],
      ],
      autumn: [
        'One of the best times: calmer winds, a warmer sea and harvest season in Stellenbosch and Franschhoek.',
        'Harvest season in the Cape winelands valleys (February – April).',
        ['The Chapman’s Peak coastal drive', 'A private safari in Kruger'],
      ],
      winter: [
        'Rainy season in Cape Town, but the best time for safari in Kruger (the dry season) and the start of whale season.',
        'Whale-watching season in Hermanus begins in June.',
        ['A Kruger safari in the dry season', 'Whale watching in Hermanus'],
      ],
      spring: [
        'Spring here runs from September to November: the warmth returns, wildflowers bloom and whale season peaks.',
        'The Hermanus Whale Festival (late September).',
        ['Kirstenbosch National Botanical Garden', 'A coastal tour to the Cape of Good Hope'],
      ],
    },
  },
};
