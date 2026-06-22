import { describe, it, expect } from 'vitest';
import { describeWeatherCode, isRainyCode, isSnowCode, rainIntensity, weatherGlyph } from './wmo';

describe('describeWeatherCode', () => {
  it('labels known codes', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky');
    expect(describeWeatherCode(3)).toBe('Overcast');
    expect(describeWeatherCode(95)).toBe('Thunderstorm');
  });
  it('falls back to Unknown', () => {
    expect(describeWeatherCode(123)).toBe('Unknown');
  });
});

describe('isRainyCode', () => {
  it.each([51, 55, 56, 61, 63, 65, 66, 80, 82, 95, 99])('treats %i as rain', (c) => {
    expect(isRainyCode(c)).toBe(true);
  });
  it.each([0, 1, 2, 3, 45, 48, 71, 73, 75, 77])('does not treat %i as rain', (c) => {
    expect(isRainyCode(c)).toBe(false);
  });
});

describe('isSnowCode', () => {
  it.each([71, 73, 75, 77, 85, 86])('treats %i as snow', (c) => {
    expect(isSnowCode(c)).toBe(true);
  });
  it('does not treat rain/clear as snow', () => {
    expect(isSnowCode(63)).toBe(false);
    expect(isSnowCode(0)).toBe(false);
  });
});

describe('rainIntensity', () => {
  it('buckets by severity', () => {
    expect(rainIntensity(51)).toBe('drizzle');
    expect(rainIntensity(61)).toBe('light');
    expect(rainIntensity(63)).toBe('moderate');
    expect(rainIntensity(65)).toBe('heavy');
    expect(rainIntensity(95)).toBe('heavy');
    expect(rainIntensity(0)).toBe('none');
    expect(rainIntensity(71)).toBe('none'); // snow is not rain
  });
});

describe('weatherGlyph', () => {
  it('maps to the four glyph buckets', () => {
    expect(weatherGlyph(0)).toBe('clear');
    expect(weatherGlyph(1)).toBe('clear');
    expect(weatherGlyph(2)).toBe('cloud');
    expect(weatherGlyph(3)).toBe('cloud');
    expect(weatherGlyph(45)).toBe('cloud');
    expect(weatherGlyph(61)).toBe('rain');
    expect(weatherGlyph(95)).toBe('rain');
    expect(weatherGlyph(73)).toBe('snow');
  });
});
