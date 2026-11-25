import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('runs in mock mode with defaults when nothing is set', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ isProd: false, port: 8787, trustProxy: false, imagesPerHour: 40, assistsPerHour: 200, image: { kind: 'mock' }, text: null });
  });

  it('treats empty values as not set', () => {
    expect(loadConfig({ IMAGE_PROVIDER: '', PORT: '', XAI_API_KEY: ' ' }).image.kind).toBe('mock');
  });

  it('picks xAI when its key is set, with the same key for AI help', () => {
    const config = loadConfig({ XAI_API_KEY: 'k', GEMINI_API_KEY: 'g' });
    expect(config.image).toEqual({ kind: 'xai', apiKey: 'k', model: 'grok-imagine-image-2.0' });
    expect(config.text).toEqual({ kind: 'xai', apiKey: 'k', model: 'grok-4.20-0309-non-reasoning' });
  });

  it('picks Gemini when only its key is set', () => {
    expect(loadConfig({ GEMINI_API_KEY: 'g' }).image).toMatchObject({ kind: 'gemini', model: 'gemini-3.1-flash-image', imageSize: '1K' });
  });

  it('honours IMAGE_PROVIDER (any case) over the keys', () => {
    const config = loadConfig({ IMAGE_PROVIDER: 'Mock', XAI_API_KEY: 'k' });
    expect(config.image.kind).toBe('mock');
    expect(config.text).toBeNull();
  });

  it('fails clearly on a provider without its key', () => {
    expect(() => loadConfig({ IMAGE_PROVIDER: 'xai' })).toThrow(new ConfigError('IMAGE_PROVIDER=xai needs XAI_API_KEY in .env'));
  });

  it('fails clearly on an unknown provider or a bad number', () => {
    expect(() => loadConfig({ IMAGE_PROVIDER: 'dalle' })).toThrow(/Unknown IMAGE_PROVIDER "dalle"/);
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/^PORT:/);
  });

  it('reads production flags', () => {
    expect(loadConfig({ NODE_ENV: 'production', TRUST_PROXY: '1', PORT: '9000' })).toMatchObject({ isProd: true, trustProxy: true, port: 9000 });
  });
});
