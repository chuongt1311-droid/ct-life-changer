import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './base64';

describe('urlBase64ToUint8Array', () => {
  it('decodes a URL-safe base64 VAPID key into bytes', () => {
    // "AAECAw" (URL-safe base64) decodes to bytes [0, 1, 2, 3]
    expect(Array.from(urlBase64ToUint8Array('AAECAw'))).toEqual([0, 1, 2, 3]);
  });

  it('pads correctly when the input length is not a multiple of 4', () => {
    // "AA" (2 chars) needs 2 padding chars to decode to a single zero byte
    expect(Array.from(urlBase64ToUint8Array('AA'))).toEqual([0]);
  });
});
