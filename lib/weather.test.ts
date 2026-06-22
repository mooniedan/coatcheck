import { describe, it, expect } from 'vitest';
import {
  currentToSnapshot,
  dailyToForecast,
  hourlyByDate,
  resolveLocationFromQuery,
  type CurrentBlock,
  type DailyBlock,
  type HourlyBlock,
} from './weather';

function current(over: Partial<CurrentBlock>): CurrentBlock {
  return {
    time: '2026-06-22T12:00',
    temperature_2m: 18,
    apparent_temperature: 17,
    relative_humidity_2m: 55,
    precipitation: 0,
    precipitation_probability: 10,
    weather_code: 0,
    wind_speed_10m: 8,
    ...over,
  };
}

describe('currentToSnapshot', () => {
  it('maps fields and derives isRaining from precipitation', () => {
    const s = currentToSnapshot(current({ precipitation: 0.4, weather_code: 3 }));
    expect(s.isRaining).toBe(true); // precipitation > 0
    expect(s.feelsLikeC).toBe(17);
    expect(s.windKph).toBe(8);
  });
  it('derives isRaining from a rain weather code', () => {
    expect(currentToSnapshot(current({ precipitation: 0, weather_code: 61 })).isRaining).toBe(true);
    expect(currentToSnapshot(current({ precipitation: 0, weather_code: 3 })).isRaining).toBe(false);
  });
  it('defaults a missing precipitation probability to 0', () => {
    const s = currentToSnapshot(current({ precipitation_probability: undefined }));
    expect(s.precipitationProbability).toBe(0);
  });
});

function daily(over: Partial<DailyBlock>): DailyBlock {
  return {
    time: ['2026-06-22'],
    temperature_2m_max: [22],
    temperature_2m_min: [12],
    apparent_temperature_max: [21],
    apparent_temperature_min: [11],
    precipitation_probability_max: [10],
    wind_speed_10m_max: [15],
    weather_code: [3],
    sunrise: ['2026-06-22T04:30'],
    sunset: ['2026-06-22T22:00'],
    ...over,
  };
}

describe('dailyToForecast', () => {
  it('maps a clean day and uses the apparent high as the representative feels-like', () => {
    const [d] = dailyToForecast(daily({}));
    expect(d.feelsLikeC).toBe(21);
    expect(d.tempMaxC).toBe(22);
    expect(d.isRaining).toBe(false);
  });
  it('flags rain when the code is dry but precip probability is high', () => {
    const [d] = dailyToForecast(
      daily({ weather_code: [3], precipitation_probability_max: [80] })
    );
    expect(d.isRaining).toBe(true); // precip fallback
  });
  it('flags rain on a rain code regardless of probability', () => {
    const [d] = dailyToForecast(daily({ weather_code: [61], precipitation_probability_max: [0] }));
    expect(d.isRaining).toBe(true);
  });
  it('drops days with a missing/misaligned field instead of emitting NaN', () => {
    const out = dailyToForecast(
      daily({
        time: ['2026-06-22', '2026-06-23'],
        temperature_2m_max: [22], // short by one → second day invalid
        temperature_2m_min: [12, 13],
        apparent_temperature_max: [21, 20],
        apparent_temperature_min: [11, 10],
        precipitation_probability_max: [10, 10],
        wind_speed_10m_max: [15, 15],
        weather_code: [3, 3],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-06-22');
  });
});

describe('hourlyByDate', () => {
  const block: HourlyBlock = {
    time: ['2026-06-22T00:00', '2026-06-22T13:00', '2026-06-23T06:00'],
    temperature_2m: [10, 18, 12],
    apparent_temperature: [9, 17, 11],
    precipitation: [0, 0.5, 0],
    precipitation_probability: [5, 70, 20],
    weather_code: [0, 61, 3],
    wind_speed_10m: [8, 12, 6],
  };

  it('buckets hours by local date', () => {
    const m = hourlyByDate(block);
    expect(m.get('2026-06-22')).toHaveLength(2);
    expect(m.get('2026-06-23')).toHaveLength(1);
  });
  it('parses the local hour and derives isRaining', () => {
    const day = hourlyByDate(block).get('2026-06-22')!;
    expect(day[0].hour).toBe(0);
    expect(day[1].hour).toBe(13);
    expect(day[1].isRaining).toBe(true); // precipitation > 0
    expect(day[0].isRaining).toBe(false);
    expect(day[1].feelsLikeC).toBe(17);
  });
});

describe('resolveLocationFromQuery', () => {
  it('accepts valid coordinates', async () => {
    const r = await resolveLocationFromQuery(null, '59.9', '10.7');
    expect(r).toMatchObject({ latitude: 59.9, longitude: 10.7 });
  });
  it('rejects non-finite coordinates', async () => {
    expect(await resolveLocationFromQuery(null, 'abc', '10')).toEqual({
      error: 'Invalid coordinates',
      status: 400,
    });
  });
  it('rejects out-of-range coordinates', async () => {
    expect(await resolveLocationFromQuery(null, '999', '10')).toMatchObject({ status: 400 });
  });
  it('rejects an over-long query', async () => {
    const r = await resolveLocationFromQuery('x'.repeat(200), null, null);
    expect(r).toEqual({ error: 'Query too long', status: 400 });
  });
  it('requires q or coordinates', async () => {
    expect(await resolveLocationFromQuery(null, null, null)).toEqual({
      error: 'Provide q or lat/lng',
      status: 400,
    });
  });
});
