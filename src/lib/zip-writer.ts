const GPBF_UTF8 = 0x0800;
const GPBF_DATA_DESCRIPTOR = 0x0008;

export interface ZipWriteTarget {
  write(part: Uint8Array): Promise<void>;
}

interface CentralRecord {
  path: string;
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  flags: number;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function uint16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function updateCrcState(state: number, bytes: Uint8Array): number {
  let crc = state;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return crc;
}

function buildLocalHeader(
  nameBytes: Uint8Array,
  data: Uint8Array,
  crc: number,
  flags: number
): Uint8Array {
  return concatBytes([
    uint32(0x04034b50),
    uint16(20),
    uint16(GPBF_UTF8 | flags),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(data.length),
    uint32(data.length),
    uint16(nameBytes.length),
    uint16(0),
    nameBytes,
    data,
  ]);
}

function buildStreamingLocalHeader(nameBytes: Uint8Array): Uint8Array {
  return concatBytes([
    uint32(0x04034b50),
    uint16(20),
    uint16(GPBF_UTF8 | GPBF_DATA_DESCRIPTOR),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(0),
    uint32(0),
    uint16(nameBytes.length),
    uint16(0),
    nameBytes,
  ]);
}

function buildCentralHeader(record: CentralRecord): Uint8Array {
  return concatBytes([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(GPBF_UTF8 | record.flags),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(record.crc),
    uint32(record.size),
    uint32(record.size),
    uint16(record.nameBytes.length),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(record.offset),
    record.nameBytes,
  ]);
}

function buildEndRecord(fileCount: number, centralSize: number, centralOffset: number): Uint8Array {
  return concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(fileCount),
    uint16(fileCount),
    uint32(centralSize),
    uint32(centralOffset),
    uint16(0),
  ]);
}

function buildDataDescriptor(crc: number, size: number): Uint8Array {
  return concatBytes([uint32(crc), uint32(size), uint32(size)]);
}

export class ZipStreamEntryWriter {
  private crcState = 0xffffffff;
  private size = 0;
  private closed = false;
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly zip: ZipStreamWriter,
    private readonly path: string,
    private readonly entryOffset: number,
    private readonly nameBytes: Uint8Array
  ) {}

  async writeText(text: string): Promise<void> {
    if (this.closed) throw new Error("ZIP entry already closed.");
    const bytes = this.encoder.encode(text);
    this.crcState = updateCrcState(this.crcState, bytes);
    this.size += bytes.length;
    await this.zip.writeRaw(bytes);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const crc = (this.crcState ^ 0xffffffff) >>> 0;
    await this.zip.writeRaw(buildDataDescriptor(crc, this.size));
    this.zip.registerEntry({
      path: this.path,
      nameBytes: this.nameBytes,
      crc,
      size: this.size,
      offset: this.entryOffset,
      flags: GPBF_DATA_DESCRIPTOR,
    });
  }
}

export class ZipStreamWriter {
  private readonly centralRecords: CentralRecord[] = [];
  private offset = 0;
  private readonly encoder = new TextEncoder();

  constructor(private readonly target: ZipWriteTarget) {}

  async writeRaw(bytes: Uint8Array): Promise<void> {
    await this.target.write(bytes);
    this.offset += bytes.length;
  }

  registerEntry(record: CentralRecord): void {
    this.centralRecords.push(record);
  }

  async addStoredEntry(path: string, content: string): Promise<void> {
    const nameBytes = this.encoder.encode(path);
    const data = this.encoder.encode(content);
    const checksum = crc32(data);
    const entryOffset = this.offset;
    const local = buildLocalHeader(nameBytes, data, checksum, 0);
    await this.writeRaw(local);
    this.registerEntry({
      path,
      nameBytes,
      crc: checksum,
      size: data.length,
      offset: entryOffset,
      flags: 0,
    });
  }

  async openStreamingEntry(path: string): Promise<ZipStreamEntryWriter> {
    const nameBytes = this.encoder.encode(path);
    const entryOffset = this.offset;
    await this.writeRaw(buildStreamingLocalHeader(nameBytes));
    return new ZipStreamEntryWriter(this, path, entryOffset, nameBytes);
  }

  async finalize(): Promise<void> {
    const centralOffset = this.offset;
    let centralSize = 0;
    for (const record of this.centralRecords) {
      const part = buildCentralHeader(record);
      await this.writeRaw(part);
      centralSize += part.length;
    }
    await this.writeRaw(
      buildEndRecord(this.centralRecords.length, centralSize, centralOffset)
    );
  }
}

/** Collect ZIP bytes in memory — for small exports only. */
export class MemoryZipTarget implements ZipWriteTarget {
  readonly parts: Uint8Array[] = [];

  async write(part: Uint8Array): Promise<void> {
    this.parts.push(part);
  }

  toArrayBuffer(): ArrayBuffer {
    const bytes = concatBytes(this.parts);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }
}
