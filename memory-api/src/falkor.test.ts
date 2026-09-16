import { describe, expect, it, vi } from 'vitest';
import { adaptGraphClient } from './falkor';

describe('adaptGraphClient', () => {
  it('wraps query() to convert direct params to QueryOptions.params', async () => {
    // Mock the real FalkorDB graph client
    const mockGraph = {
      query: vi.fn().mockResolvedValue({ data: [['row1'], ['row2']] }),
      roQuery: vi.fn(),
    };

    const client = adaptGraphClient(mockGraph as never);

    // Call the adapted client with direct params
    const result = await client.query('MATCH (n) RETURN n', { foo: 'bar', baz: 42 });

    // Verify the real client was called with the params nested in an options object
    expect(mockGraph.query).toHaveBeenCalledWith('MATCH (n) RETURN n', { params: { foo: 'bar', baz: 42 } });
    expect(result).toEqual({ data: [['row1'], ['row2']] });
  });

  it('wraps roQuery() to convert direct params to QueryOptions.params', async () => {
    const mockGraph = {
      query: vi.fn(),
      roQuery: vi.fn().mockResolvedValue({ data: [['result']] }),
    };

    const client = adaptGraphClient(mockGraph as never);

    const result = await client.roQuery('MATCH (n) RETURN n', { key: 'value' });

    expect(mockGraph.roQuery).toHaveBeenCalledWith('MATCH (n) RETURN n', { params: { key: 'value' } });
    expect(result).toEqual({ data: [['result']] });
  });

  it('defaults data to [] when the real client returns undefined data', async () => {
    const mockGraph = {
      query: vi.fn().mockResolvedValue({ data: undefined }),
      roQuery: vi.fn(),
    };

    const client = adaptGraphClient(mockGraph as never);

    const result = await client.query('MATCH (n) RETURN n');

    expect(result.data).toEqual([]);
  });

  it('passes undefined params as { params: undefined }', async () => {
    const mockGraph = {
      query: vi.fn().mockResolvedValue({ data: [] }),
      roQuery: vi.fn(),
    };

    const client = adaptGraphClient(mockGraph as never);

    await client.query('MATCH (n) RETURN n');

    expect(mockGraph.query).toHaveBeenCalledWith('MATCH (n) RETURN n', { params: undefined });
  });
});
