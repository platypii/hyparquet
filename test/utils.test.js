import { describe, expect, it, vi } from 'vitest'
import { asyncBufferFromUrl, byteLengthFromUrl, toJson } from '../src/utils.js'

describe('toJson', () => {
  it('convert undefined to null', () => {
    expect(toJson(undefined)).toBe(null)
    expect(toJson(null)).toBe(null)
  })

  it('convert bigint to number', () => {
    expect(toJson(BigInt(123))).toBe(123)
    expect(toJson([BigInt(123), BigInt(456)])).toEqual([123, 456])
    expect(toJson({ a: BigInt(123), b: { c: BigInt(456) } })).toEqual({ a: 123, b: { c: 456 } })
  })

  it('convert Uint8Array to array of numbers', () => {
    expect(toJson(new Uint8Array([1, 2, 3]))).toEqual([1, 2, 3])
  })

  it('convert Date to ISO string', () => {
    const date = new Date('2023-05-27T00:00:00Z')
    expect(toJson(date)).toBe(date.toISOString())
  })

  it('ignore undefined properties in objects', () => {
    expect(toJson({ a: undefined, b: BigInt(123) })).toEqual({ b: 123 })
  })

  it('return null in objects unchanged', () => {
    expect(toJson({ a: null })).toEqual({ a: null })
    expect(toJson([null])).toEqual([null])
  })

  it('return other types unchanged', () => {
    expect(toJson('string')).toBe('string')
    expect(toJson(123)).toBe(123)
    expect(toJson(true)).toBe(true)
  })
})

describe('byteLengthFromUrl', () => {
  it('returns the byte length from Content-Length header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['Content-Length', '1024']]),
    })

    const result = await byteLengthFromUrl('https://example.com')
    expect(result).toBe(1024)
    expect(fetch).toHaveBeenCalledWith('https://example.com', { method: 'HEAD' })
  })

  it('throws an error if the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    await expect(byteLengthFromUrl('https://example.com')).rejects.toThrow('fetch head failed 404')
  })

  it('throws an error if Content-Length header is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map(),
    })

    await expect(byteLengthFromUrl('https://example.com')).rejects.toThrow('missing content length')
  })
})

describe('asyncBufferFromUrl', () => {
  it('creates an AsyncBuffer with the correct byte length', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Content-Length', '1024']]),
      })

    const buffer = await asyncBufferFromUrl('https://example.com')
    expect(buffer.byteLength).toBe(1024)
  })

  it('uses provided byte length if given', async () => {
    const buffer = await asyncBufferFromUrl('https://example.com', 2048)
    expect(buffer.byteLength).toBe(2048)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('slice method fetches correct byte range', async () => {
    const mockArrayBuffer = new ArrayBuffer(100)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    })

    const buffer = await asyncBufferFromUrl('https://example.com', 1024)
    const result = await buffer.slice(0, 100)

    expect(result).toBe(mockArrayBuffer)
    expect(fetch).toHaveBeenCalledWith('https://example.com', {
      headers: new Headers({ Range: 'bytes=0-99' }),
    })
  })

  it('slice method handles undefined end parameter', async () => {
    const mockArrayBuffer = new ArrayBuffer(100)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    })

    const buffer = await asyncBufferFromUrl('https://example.com', 1024)
    await buffer.slice(100)

    expect(fetch).toHaveBeenCalledWith('https://example.com', {
      headers: new Headers({ Range: 'bytes=100-' }),
    })
  })

  it('slice method throws an error if fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const buffer = await asyncBufferFromUrl('https://example.com', 1024)
    await expect(buffer.slice(0, 100)).rejects.toThrow('fetch failed 404')
  })
})
