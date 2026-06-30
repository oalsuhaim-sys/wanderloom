import type { AppMessages } from './ar';

/** English messages — same shape as Arabic dictionary */
export const en = {
  brand: {
    name: 'Wanderloom',
    tagline: 'Luxury journey architecture',
    heroBadge: 'Wanderloom · Luxury journey architecture',
  },

  nav: {
    home: 'Home',
    about: 'About',
    discover: 'Discover',
    sessions: 'Sessions',
    lead: 'Plan your trip',
    portal: 'Client portal',
    menuAria: 'Menu',
  },

  home: {
    heroTitleLine1: 'We weave your journey',
    heroTitleLine2: '— thread by thread',
    heroLead:
      'Itineraries tailored to your taste — from the first day to the last moment when the trip feels like one continuous story.',
    ctaSessions: 'Available sessions',
    ctaLead: 'Plan your trip',
    ctaPortal: 'Client portal',
    aboutKicker: 'About us',
    aboutTitle: 'Wanderloom',
    aboutQuote:
      'We are not a traditional travel agency. Every journey is built inside out: from reading the client’s personality, to engineering day one, to weaving the remaining days as chapters in one harmonious piece. The hotel is a note, the street a measure, the café a pause, the landmark a crescendo — all written in the keys of your taste, not off-the-shelf metrics.',
    discoverMore: 'Discover more',
    sessionsTitle: 'Available sessions',
    sessionsLead:
      'Live sessions from our calendar — for full registration we recommend the client portal after you choose a session.',
    groupsTitle: 'Group journeys',
    groupsBody:
      'We design group experiences with one rhythm: families, friends, or work teams — with daily coordination that lifts the burden of details and leaves room to enjoy together.',
    groupsCardsHint:
      'Choose one of the paths below to register your group — our team will contact you with dates and program details.',
    groupTripJapanTitle: 'Family journey to Japan',
    groupTripJapanBlurb:
      'A route that puts family comfort and variety first: activities for all ages and flexible timing.',
    groupTripKoreaTitle: 'Friends trip to Korea',
    groupTripKoreaBlurb:
      'For groups who love urban energy and visual culture: Seoul, street food, and unforgettable photos.',
    groupTripEuropeTitle: 'Business trip to Europe',
    groupTripEuropeBlurb:
      'For work teams and delegations: a tight schedule, meeting-friendly hotels, and space to balance work and exploration.',
    groupRegisterCta: 'Register your group',
    groupModalTitle: 'Group registration',
    groupModalTrip: 'Trip',
    groupNameLabel: 'Full name *',
    groupNamePlaceholder: 'Group representative name',
    groupWaLabel: 'WhatsApp number *',
    groupWaPlaceholder: '9665xxxxxxxx',
    groupSizeLabel: 'Group size *',
    groupSubmit: 'Submit request',
    groupModalClose: 'Close',
    groupsCta: 'Contact us',
    waGroupsPresetMessage: 'Hello Wanderloom — I would like information about group trips.',
    contactTitle: 'Contact us',
    contactLead:
      'Have a special inquiry or partnership idea? Our team is ready to hear you — outside booking a specific trip.',
    contactWhatsAppCta: 'WhatsApp chat',
    contactEmailCta: 'Email us',
    contactEmailAddress: 'oalsuhaim@wanderloomsa.com',
    contactWaPresetMessage: 'Hello Wanderloom — I have a general inquiry and would like to get in touch.',
    leadTitle: 'Plan your trip',
    leadBody:
      'The interactive form below sends your details to our leads table — without reloading the page — so the Wanderloom team can build your route step by step.',
    footerBrand: 'WANDERLOOM',
    footerTagline: 'Journey architecture · Sessions · Private routes',
  },

  discover: {
    metaTitle: 'Discover — Wanderloom philosophy',
    metaDescription:
      'Not a travel agency, but a factory of travel symphonies: how we design your journey from personality and taste at Wanderloom.',
    kicker: 'Discover',
    heroTitle: 'A symphony factory',
    heroHighlight: 'not a travel agency',
    heroLead:
      'We do not sell tickets and ready-made programs. We compose your journey as one musical piece: introduction, verse, climax, and finale — all built on who you are, not what sells to everyone.',
    sectionModelTitle: 'The travel model',
    sectionModelBody:
      'Every client carries a different rhythm: calm or excitement, historical depth or visual wonder, street food or luxury experiences. We read this rhythm in your questionnaire, your conversation, your small details — then turn it into harmonious days where every stop serves the feeling you want to leave with.',
    sectionPhilosophyTitle: 'Design philosophy',
    sectionPhilosophyBody:
      'A journey with us is not a list of landmarks, but a story. The hotel is chosen as a warm note or a loud interlude; walking the neighborhood is tuned to your energy; time “between” appointments is left on purpose so the scene can breathe. We believe luxury travel is when the plan disappears from view and only the experience remains.',
    sectionYouTitle: 'You are the center of the symphony',
    sectionYouBody:
      'We do not impose a destination “because it is famous,” but build it because it fits your personality. Japan for lovers of fine detail differs from Japan for anime and cultural layers — and each is a project in itself.',
    ctaLead: 'Start designing your trip',
    ctaSessions: 'Browse sessions',
    backHome: 'Back to home',
  },

  tripForm: {
    section1Title: 'Contact',
    section1Subtitle: 'We start with a clear plan to reach you',
    fullName: 'Your name *',
    fullNamePlaceholder: 'How you would like us to address you',
    phoneWa: 'WhatsApp number *',
    phonePlaceholder: '9665xxxxxxxx',
    sourceLabel: 'How did you hear about Wanderloom?',
    sourcePlaceholder: 'Select…',
    sourceInstagram: 'Instagram',
    sourceTiktok: 'TikTok',
    sourceSnap: 'Snapchat',
    sourceFriend: 'Friend referral',
    sourceGoogle: 'Search / Google',
    sourceEvent: 'Event or meeting',
    sourceOther: 'Other',
    section2Title: 'Destination',
    section2Subtitle: 'Choose countries first, then only cities for your selected countries appear',
    countriesLabel: 'Countries * (multiple allowed)',
    citiesHeading: 'Cities for your selected countries',
    travelDate: 'Preferred travel date (approximate)',
    travelDays: 'Trip length (days) *',
    travelersCount: 'Number of travelers *',
    budget: 'Approximate budget',
    budgetUndecided: 'Not decided yet',
    budgetEconomical: 'Elegant economy',
    budgetModerate: 'Comfortable mid-range',
    budgetComfortable: 'Elevated comfort & experience',
    budgetPremium: 'Luxury with no rough ceiling',
    section3Title: 'Interests',
    section3Subtitle: 'What captures your imagination on this trip?',
    interestAnime: 'Anime & pop culture',
    interestHistory: 'History & heritage',
    interestNature: 'Nature & scenery',
    interestKpop: 'K-pop & K-drama',
    interestShopping: 'Shopping & fashion',
    interestSeasonal: 'Seasonal events & festivals',
    interestAdventure: 'Adventure & local experiences',
    interestWorkshops: 'Workshops & crafts',
    interestSpa: 'Wellness & spa',
    interestPhoto: 'Photography tours',
    visitSectionTitle: 'Previous visits to your selected destinations',
    visitBeforeCountry: 'Have you traveled to {country} before?',
    section4Title: 'Daily rhythm',
    section4Subtitle: 'We tune the trip pace to your energy',
    paceLabel: 'Day pace',
    paceCalm: 'Calm',
    paceMedium: 'Moderate',
    paceActive: 'Active',
    walkingLabel: 'Walking readiness',
    walkLow: 'Light',
    walkMed: 'Moderate',
    walkHigh: 'Ready for longer walks',
    dayStartLabel: 'Preferred day start',
    startEarly: 'Early',
    startMid: 'Mid-morning',
    startLate: 'Late',
    section5Title: 'Food & lodging',
    section5Subtitle: 'Details respected in the design',
    foodLabel: 'Food preferences (multiple allowed)',
    foodHalal: 'Halal',
    foodSeafood: 'Seafood',
    foodVegetarian: 'Vegetarian',
    foodFlex: 'Flexible / no strict limits',
    lodgingLabel: 'Preferred lodging type',
    lodgingBoutique: 'Boutique',
    lodging4: '4 stars',
    lodging5: '5 stars',
    lodgingRyokan: 'Ryokan',
    section6Title: 'The dream',
    section6Subtitle: 'One sentence can change every detail',
    dreamLabel: 'How do you want to feel at the end of this trip? *',
    dreamPlaceholder:
      'Write freely… calm, pride, wonder, closeness to loved ones, or any feeling you want to keep after the last day.',
    submit: 'Submit trip design',
    yes: 'Yes',
    no: 'No',
  },

  sessions: {
    loading: 'Loading sessions…',
    loadErrorPrefix: 'Sorry, an error occurred while loading sessions.',
    emptyTitle: 'No sessions available right now — stay tuned',
    emptyLeadPrefix: 'You can send your request via',
    emptyLeadLink: 'Plan your trip form',
    emptyLeadSuffix: 'and we will contact you when new sessions are available.',
    demoBanner:
      'Demo mode: sample data for display until Supabase connection is complete in production.',
    seatsLeft: '{n} seats left',
    full: 'Full',
    register: 'Register now',
    modalTitle: 'Session registration',
    modalClose: 'Close',
    nameLabel: 'Full name *',
    namePlaceholder: 'e.g. Nora Al-Otaibi',
    waLabel: 'WhatsApp number *',
    waPlaceholder: '05xxxxxxxx',
    submit: 'Submit registration',
    modalFooterPrefix: 'Or complete a broader trip request from',
    modalFooterLink: 'Plan your trip form',
    location: 'Location',
    mapLocationCta: 'View location on map',
    emptyShort: 'No sessions available right now',
    typeOnline: 'Online',
    typeInPerson: 'In person',
    typeGeneric: 'Session',
    clientMissingSession: 'Sorry, the session could not be identified. Reload the page and try again.',
    clientNameWaRequired: 'Please fill in your full name and WhatsApp number — both are required.',
    success: 'Your registration was sent successfully!',
    successWithTime: 'Your registration was sent successfully! (Registered at: {time})',
  },

  common: {
    yes: 'Yes',
    no: 'No',
    free: 'Free',
    currencySuffix: 'SAR',
  },

  errors: {
    trip: {
      namePhone: 'Please fill in all required fields: your name and WhatsApp number.',
      dreamRequired:
        'Please answer “How do you want to feel at the end of this trip?” — this field is required.',
      countryRequired: 'Please select at least one country from the destination list before submitting.',
      cityRequired:
        'Please select at least one city for each country you chose (cities appear after selecting a country).',
      visitNotAnswered:
        'Please answer “Have you traveled to {country} before?” for all countries you selected.',
      dbNotConfigured:
        'Sorry, the lead saving system is not configured on the server. Please try later or contact us directly.',
      dbConnection:
        'There seems to be a server connection issue or temporary network outage. Please check your internet and try again.',
      dbPermission:
        'Sorry, permission to save the request is not available right now. If this persists, please contact support.',
      dbTableMissing:
        'Sorry, the leads table is not set up in the database. Create the customers table via supabase/sql/customers_leads.sql',
      dbColumnsHint:
        ' You may also need to run supabase/sql/customers_trip_form_columns.sql to add required columns.',
      dbSaveFailed:
        'Sorry, your request could not be saved. Please check all required fields and try again.',
      dbSaveFailedDetail: 'Technical details (for support): {detail}',
    },
    session: {
      inputRequired:
        'Please fill in your full name and WhatsApp number — both are required for registration.',
      dbNotConfigured:
        'Demo mode: database connection is not enabled. Set environment variables and try again.',
      sessionNotFound: 'Sorry, this session does not exist or is no longer available.',
      sessionFull: 'Sorry, this session is full and no seats are available.',
      duplicateWhatsapp: 'You are already registered for this session with this number.',
      raceNoSeat:
        'Sorry, seats ran out while submitting your request. Your registration was not saved — please choose another session.',
      customerSaveFailed:
        'Sorry, your session registration was saved but we could not complete your interest profile. Please try again or contact us on WhatsApp.',
      genericRegistration: 'Sorry, an error occurred during registration. Please try again.',
      readSessionFailed: 'Could not read session data from the server.',
      saveRegistrationFailed: 'Could not save registration in the database.',
    },
    groupTrip: {
      missingPackage: 'Please select a group trip type.',
      invalidSize: 'Please enter group size (a whole number greater than zero).',
      emailRequired: 'Please enter your email address.',
      invalidEmail: 'Please enter a valid email address.',
      ageRequired: 'Please enter your age.',
      invalidAge: 'Please enter a valid age.',
    },
  },

  success: {
    tripLeadSent: 'Your request was sent successfully! The Wanderloom team will contact you soon with clear next steps.',
    groupTripRegistered:
      'Your group was registered successfully! The Wanderloom team will contact you on WhatsApp soon.',
  },
} as const satisfies AppMessages;
