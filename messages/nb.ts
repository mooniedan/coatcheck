// Norwegian Bokmål messages. Mirrors the en.ts key structure.
import type { Messages } from './en';

export const nb: Messages = {
  tagline: 'Hva bør du ha på deg i dag? Si hvor du er.',
  loading: 'Sjekker himmelen…',
  language: { label: 'Språk', en: 'English', nb: 'Norsk' },

  nav: { trips: 'Turer', family: 'Familie', admin: 'Admin' },

  search: { placeholder: 'By eller adresse…', check: 'Sjekk', me: 'Meg' },

  profilesFor: 'For:',

  view: { scene: 'Scene', list: 'Liste' },

  home: {
    setHome: 'Angi som hjem',
    home: 'Hjem',
    saved: 'Lagret som hjemstedet ditt.',
    cleared: 'Hjemsted fjernet.',
    couldNotSave: 'Kunne ikke lagre hjemsted.',
  },

  beta: {
    closedTesting: 'Coat Check er i lukket testing.',
    join: 'Bli med i betaen',
    waitlisted: 'Du er logget inn, men ikke tester ennå. Coat Check er i lukket testing.',
    confirm: 'Bekreft plassen din',
  },

  invite: {
    shared: 'inviterte deg til å dele familien sin.',
    join: 'Bli med',
    notNow: 'Ikke nå',
    someone: 'Noen',
  },

  feedback: {
    tooCold: 'For kaldt',
    tooHot: 'For varmt',
    perfect: 'Perfekt',
    signInToAdd: 'Logg inn for å gi tilbakemelding.',
    todayOnly: 'Tilbakemelding gjelder dagens antrekk.',
    thanks: 'Takk – notert til neste gang.',
    couldNotSave: 'Kunne ikke lagre tilbakemelding.',
  },

  clothing: {
    tank: 'Singlet',
    tshirt: 'T-skjorte',
    long_sleeve: 'Langermet trøye',
    sweater: 'Genser',
    thermal_top: 'Ulltrøye',
    shorts: 'Shorts',
    trousers: 'Bukse / jeans',
    thermal_leggings: 'Ullongs',
    light_jacket: 'Lett jakke',
    heavy_coat: 'Tykk frakk',
    raincoat: 'Regnjakke',
    windbreaker: 'Vindjakke',
    umbrella: 'Paraply',
    sunglasses: 'Solbriller',
    beanie: 'Lue',
    gloves: 'Hansker',
    scarf: 'Skjerf',
  },

  weather: {
    '0': 'Klarvær',
    '1': 'Stort sett klart',
    '2': 'Delvis skyet',
    '3': 'Overskyet',
    '45': 'Tåke',
    '48': 'Rimtåke',
    '51': 'Lett yr',
    '53': 'Yr',
    '55': 'Kraftig yr',
    '56': 'Underkjølt yr',
    '57': 'Underkjølt yr',
    '61': 'Lett regn',
    '63': 'Regn',
    '65': 'Kraftig regn',
    '66': 'Underkjølt regn',
    '67': 'Underkjølt regn',
    '71': 'Lett snø',
    '73': 'Snø',
    '75': 'Kraftig snø',
    '77': 'Snøkorn',
    '80': 'Regnbyger',
    '81': 'Regnbyger',
    '82': 'Kraftige regnbyger',
    '85': 'Snøbyger',
    '86': 'Snøbyger',
    '95': 'Tordenvær',
    '96': 'Tordenvær med hagl',
    '99': 'Tordenvær med hagl',
  },
};
