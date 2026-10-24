import { describe, it, expect } from 'vitest'
import {
  parseMariaDbMajorReleases,
  parseMariaDbFiles,
} from '../MariaDbResolver.ts'
import {
  parsePythonVersionList,
  buildPythonEmbeddableUrl,
} from '../SimpleResolvers.ts'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MARIADB_MAJOR_RELEASES_FIXTURE = {
  major_releases: [
    { release_id: '13.2.1', release_name: '13.2', release_status: 'Preview', release_support_type: null, release_eol_date: null },
    { release_id: '13.1.2', release_name: '13.1', release_status: 'Release Candidate', release_support_type: null, release_eol_date: null },
    { release_id: '13.0.5', release_name: '13.0', release_status: 'Stable', release_support_type: 'Short Term Support', release_eol_date: '2025-06-01' },
    { release_id: '12.3.3', release_name: '12.3', release_status: 'Stable', release_support_type: 'Long Term Support', release_eol_date: '2029-06-12' },
    { release_id: '11.8.2', release_name: '11.8', release_status: 'Stable', release_support_type: 'Long Term Support', release_eol_date: '2030-02-13' },
    { release_id: '11.4.5', release_name: '11.4', release_status: 'Maintenance', release_support_type: 'Long Term Support', release_eol_date: '2025-06-18' },
  ]
}

const MARIADB_12_3_3_FILES_FIXTURE = {
  releases: {
    '12.3.3': {
      files: [
        {
          file_id: 12345,
          file_name: 'mariadb-12.3.3-winx64.zip',
          package_type: 'Zip File',
          os: 'Windows',
          cpu: 'x86_64',
          checksum: { sha256sum: '4b5706b47148b47c8f36963c8352d1ddee37a1287b4690428f631a74b09b85a0' },
          file_download_url: 'https://dlm.mariadb.com/12.3.3/mariadb-12.3.3-winx64.zip'
        },
        {
          file_id: 12346,
          file_name: 'mariadb-12.3.3-linux-x86_64.tar.gz',
          package_type: 'Tarball',
          os: 'Linux',
          cpu: 'x86_64',
          checksum: { sha256sum: 'abc123' },
          file_download_url: 'https://dlm.mariadb.com/12.3.3/mariadb-12.3.3-linux-x86_64.tar.gz'
        }
      ]
    }
  }
}

const PYTHON_LISTING_HTML = `
<html><body>
<a href="3.13.2/">3.13.2/</a>
<a href="3.13.1/">3.13.1/</a>
<a href="3.12.7/">3.12.7/</a>
<a href="3.11.9/">3.11.9/</a>
</body></html>
`

const PYTHON_LISTING_EMPTY = '<html><body>No versions here</body></html>'

const PYTHON_LISTING_MALFORMED = 'not html at all'

// ── MariaDB parseMariaDbMajorReleases ────────────────────────────────────────

describe('parseMariaDbMajorReleases', () => {
  it('returns newest LTS for stable/lts channel', () => {
    const result = parseMariaDbMajorReleases(MARIADB_MAJOR_RELEASES_FIXTURE, 'stable')
    expect(result).not.toBeNull()
    expect(result?.version).toBe('12.3.3') // newest LTS
    expect(result?.supportType).toBe('Long Term Support')
  })

  it('returns newest LTS for lts channel', () => {
    const result = parseMariaDbMajorReleases(MARIADB_MAJOR_RELEASES_FIXTURE, 'lts')
    expect(result?.version).toBe('12.3.3')
  })

  it('returns newest Stable for latest channel (includes non-LTS stable)', () => {
    const result = parseMariaDbMajorReleases(MARIADB_MAJOR_RELEASES_FIXTURE, 'latest')
    expect(result?.version).toBe('13.0.5') // newest Stable (STS)
  })

  it('throws descriptive error on missing major_releases array', () => {
    expect(() => parseMariaDbMajorReleases({}, 'stable'))
      .toThrow('format API berubah: major_releases bukan array')
  })

  it('throws on null input', () => {
    expect(() => parseMariaDbMajorReleases(null, 'stable'))
      .toThrow('format API berubah: root bukan object di downloads.mariadb.org')
  })

  it('returns null when no matching channel releases exist', () => {
    const fixture = {
      major_releases: [
        { release_id: '13.2.1', release_name: '13.2', release_status: 'Preview', release_support_type: null, release_eol_date: null },
      ]
    }
    const result = parseMariaDbMajorReleases(fixture, 'stable')
    expect(result).toBeNull()
  })
})

// ── MariaDB parseMariaDbFiles ────────────────────────────────────────────────

describe('parseMariaDbFiles', () => {
  it('returns winx64 zip with correct fields', () => {
    const result = parseMariaDbFiles(MARIADB_12_3_3_FILES_FIXTURE, '12.3.3')
    expect(result).not.toBeNull()
    expect(result?.url).toBe('https://dlm.mariadb.com/12.3.3/mariadb-12.3.3-winx64.zip')
    expect(result?.sha256).toBe('4b5706b47148b47c8f36963c8352d1ddee37a1287b4690428f631a74b09b85a0')
    expect(result?.archiveRoot).toBe('mariadb-12.3.3-winx64')
  })

  it('throws on missing releases object', () => {
    expect(() => parseMariaDbFiles({ releases: {} }, '12.3.3'))
      .toThrow('format API berubah: files array tidak ditemukan untuk 12.3.3')
  })

  it('throws on null input', () => {
    expect(() => parseMariaDbFiles(null, '12.3.3'))
      .toThrow('format API berubah: root bukan object untuk MariaDB 12.3.3')
  })

  it('returns null when no Windows x64 zip found', () => {
    const fixture = {
      releases: {
        '12.3.3': {
          files: [
            { file_id: 1, file_name: 'mariadb-12.3.3-linux.tar.gz', package_type: 'Tarball', os: 'Linux', cpu: 'x86_64', checksum: { sha256sum: 'abc' }, file_download_url: 'https://dlm.mariadb.com/12.3.3/mariadb-12.3.3-linux.tar.gz' }
          ]
        }
      }
    }
    const result = parseMariaDbFiles(fixture, '12.3.3')
    expect(result).toBeNull()
  })

  it('rejects URL outside allowlist', () => {
    const fixture = {
      releases: {
        '12.3.3': {
          files: [
            { file_id: 1, file_name: 'mariadb-12.3.3-winx64.zip', package_type: 'Zip File', os: 'Windows', cpu: 'x86_64', checksum: { sha256sum: 'abc' }, file_download_url: 'https://evil.com/mariadb.zip' }
          ]
        }
      }
    }
    const result = parseMariaDbFiles(fixture, '12.3.3')
    expect(result).toBeNull()
  })
})

// ── Python parsePythonVersionList ────────────────────────────────────────────

describe('parsePythonVersionList', () => {
  it('extracts versions sorted newest first', () => {
    const versions = parsePythonVersionList(PYTHON_LISTING_HTML)
    expect(versions).toEqual(['3.13.2', '3.13.1', '3.12.7', '3.11.9'])
  })

  it('throws on empty listing', () => {
    expect(() => parsePythonVersionList(PYTHON_LISTING_EMPTY))
      .toThrow('tidak ada direktori versi Python ditemukan di listing python.org')
  })

  it('throws on malformed input (no version dirs found)', () => {
    expect(() => parsePythonVersionList(PYTHON_LISTING_MALFORMED))
      .toThrow('tidak ada direktori versi Python ditemukan di listing python.org')
  })

  it('throws on null input', () => {
    expect(() => parsePythonVersionList(null as any))
      .toThrow('format listing berubah: HTML kosong atau bukan string')
  })
})

// ── Python buildPythonEmbeddableUrl ──────────────────────────────────────────

describe('buildPythonEmbeddableUrl', () => {
  it('builds correct URL, archiveRoot, and filename for 3.13.2', () => {
    const result = buildPythonEmbeddableUrl('3.13.2')
    expect(result.url).toBe('https://www.python.org/ftp/python/3.13.2/python-3.13.2-embed-amd64.zip')
    expect(result.archiveRoot).toBe('python-3.13.2-embed-amd64')
    expect(result.filename).toBe('python-3.13.2-embed-amd64.zip')
  })

  it('builds correct values for 3.12.7', () => {
    const result = buildPythonEmbeddableUrl('3.12.7')
    expect(result.url).toBe('https://www.python.org/ftp/python/3.12.7/python-3.12.7-embed-amd64.zip')
    expect(result.archiveRoot).toBe('python-3.12.7-embed-amd64')
    expect(result.filename).toBe('python-3.12.7-embed-amd64.zip')
  })
})