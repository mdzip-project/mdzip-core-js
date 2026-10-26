## Added

- Built-in ZIP-bomb limits (spec §13.1): `open()` rejects an archive with more
  than 100,000 entries, an entry over 1 GiB, more than 4 GiB in total, or an
  entry over 1 MiB compressed more than 1000:1, with `ERR_LIMIT_EXCEEDED`. The
  limits are exported as `MDZ_MAX_ENTRIES`, `MDZ_MAX_ENTRY_UNCOMPRESSED_BYTES`,
  `MDZ_MAX_TOTAL_UNCOMPRESSED_BYTES` and `MDZ_MAX_COMPRESSION_RATIO`, and are
  not configurable.
- Spec fixtures synced to [Spec v1.2.1](https://github.com/mdzip-project/mdzip-spec/releases/tag/v1.2.1),
  including the new T-018 ZIP-bomb tests.

## Fixed

- Reads (`readText`, `readBytes`, `readBase64`, manifest reads, workspace
  documents and assets) stop at an entry's declared size and check its CRC-32.
  An entry that expands past its declared size used to be decompressed in full
  and then fail with no error code; it's now `ERR_LIMIT_EXCEEDED`. Short,
  mismatched or undecompressable data is `ERR_ZIP_INVALID`.
- `open()` no longer hides central directory entries the ZIP library can't
  expose, such as several entries pointing at the same data: the archive is
  rejected with `ERR_ZIP_INVALID` (spec §4).

Fixes #10.

## Upgrading

Archives that opened before can now be rejected if they exceed the limits or
contain corrupt data. Archives opened with a custom `zipFactory` get only the
entry-count limit, since that library does the decompression.

## Validation

105 tests passed; 3 optional tests skipped. Includes the spec's T-018 fixtures
(forged sizes, an extreme compression ratio, overlapping entries), a corrupted
checksum, and stored/deflated round trips.
