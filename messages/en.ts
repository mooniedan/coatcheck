// English messages (the source language / fallback). Keys are dot-pathed via useT().
export const en = {
  tagline: 'What should you wear today? Tell me where you are.',
  loading: 'Checking the skies…',
  language: { label: 'Language', en: 'English', nb: 'Norsk' },

  nav: { trips: 'Trips', family: 'Family', admin: 'Admin' },

  search: { placeholder: 'City or address…', check: 'Check', me: 'Me' },

  profilesFor: 'For:',

  view: { scene: 'Scene', list: 'List' },

  home: {
    setHome: 'Set as home',
    home: 'Home',
    saved: 'Saved as your home.',
    cleared: 'Home cleared.',
    couldNotSave: 'Could not save home.',
  },

  beta: {
    closedTesting: 'Coat Check is in closed testing.',
    join: 'Join the beta',
    waitlisted: 'You’re signed in but not yet a tester. Coat Check is in closed testing.',
    confirm: 'Confirm your spot',
  },

  invite: { shared: 'invited you to share their family.', join: 'Join', notNow: 'Not now', someone: 'Someone' },

  feedback: {
    tooCold: 'Too cold',
    tooHot: 'Too hot',
    perfect: 'Perfect',
    signInToAdd: 'Sign in to add feedback.',
    todayOnly: 'Feedback applies to today’s outfit.',
    thanks: 'Thanks — noted for next time.',
    couldNotSave: 'Could not save feedback.',
  },

  clothing: {
    tank: 'Tank top',
    tshirt: 'T-shirt',
    long_sleeve: 'Long-sleeve shirt',
    sweater: 'Sweater',
    thermal_top: 'Thermal base layer',
    shorts: 'Shorts',
    trousers: 'Trousers / jeans',
    thermal_leggings: 'Thermal leggings',
    light_jacket: 'Light jacket',
    heavy_coat: 'Heavy coat',
    raincoat: 'Raincoat',
    windbreaker: 'Windbreaker',
    umbrella: 'Umbrella',
    sunglasses: 'Sunglasses',
    beanie: 'Beanie',
    gloves: 'Gloves',
    scarf: 'Scarf',
  },

  weather: {
    '0': 'Clear sky',
    '1': 'Mainly clear',
    '2': 'Partly cloudy',
    '3': 'Overcast',
    '45': 'Fog',
    '48': 'Rime fog',
    '51': 'Light drizzle',
    '53': 'Drizzle',
    '55': 'Heavy drizzle',
    '56': 'Freezing drizzle',
    '57': 'Freezing drizzle',
    '61': 'Light rain',
    '63': 'Rain',
    '65': 'Heavy rain',
    '66': 'Freezing rain',
    '67': 'Freezing rain',
    '71': 'Light snow',
    '73': 'Snow',
    '75': 'Heavy snow',
    '77': 'Snow grains',
    '80': 'Rain showers',
    '81': 'Rain showers',
    '82': 'Violent rain showers',
    '85': 'Snow showers',
    '86': 'Snow showers',
    '95': 'Thunderstorm',
    '96': 'Thunderstorm with hail',
    '99': 'Thunderstorm with hail',
  },
};

export type Messages = typeof en;
