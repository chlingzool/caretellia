import type { LetterSticker, PostcardData } from "./types/postcard";

const MAGIC = new Uint8Array([0x43, 0x4c, 0x43, 0x00]);
const VERSION = 1;
const HEADER_SIZE = 48;
export const MAX_CLC_FILE_SIZE = 64 * 1024 * 1024;
export const MAX_CLC_PAYLOAD_SIZE = 32 * 1024 * 1024;

function assertPostcardData(value: unknown): asserts value is PostcardData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CLC 内容不是有效的信件对象");
  }
  const card = value as Record<string, unknown>;
  const strings = [
    "id", "title", "message", "caption", "backCaption", "note", "from", "to",
    "bgColor", "textColor", "borderColor", "stampText", "stampImage", "cardImage",
    "titleFont", "messageFont", "captionFont", "backCaptionFont", "fromFont",
    "toFont", "stampFont", "createdAt",
  ];
  for (const key of strings) {
    if (typeof card[key] !== "string") throw new Error(`CLC 字段无效：${key}`);
  }
  for (const key of ["bgColor", "textColor", "borderColor"]) {
    if (!/^#[\da-f]{3,4}(?:[\da-f]{2}){0,2}$/i.test(card[key] as string)) {
      throw new Error(`CLC 颜色无效：${key}`);
    }
  }
  for (const key of [
    "titleFont", "messageFont", "captionFont", "backCaptionFont",
    "fromFont", "toFont", "stampFont",
  ]) {
    const font = card[key] as string;
    if (font.length > 128 || /['";{}<>\\\u0000-\u001f]/.test(font)) {
      throw new Error(`CLC 字体名称无效：${key}`);
    }
  }
  for (const key of ["stampImage", "cardImage"]) {
    const source = card[key] as string;
    if (source && !/^data:image\/[a-z\d.+-]+;base64,[a-z\d+/]*={0,2}$/i.test(source)) {
      throw new Error(`CLC 图片数据无效：${key}`);
    }
  }
  if (typeof card.id !== "string" || !card.id || card.id.length > 128) {
    throw new Error("CLC 信件 ID 无效");
  }
  if (!["envelope", "postcard", "letter"].includes(String(card.type))) {
    throw new Error("CLC 信件类型无效");
  }
  if (!Number.isFinite(card.fontSize) || Number(card.fontSize) < 1 || Number(card.fontSize) > 300) {
    throw new Error("CLC 字号无效");
  }
  if (!["solid", "dashed", "double", "dotted"].includes(String(card.borderStyle))) {
    throw new Error("CLC 边框样式无效");
  }
  for (const key of ["messageHtml", "backCaptionHtml"]) {
    if (card[key] !== undefined && typeof card[key] !== "string") {
      throw new Error(`CLC 字段无效：${key}`);
    }
  }
  if (card.stickers !== undefined) {
    if (!Array.isArray(card.stickers) || card.stickers.length > 100) {
      throw new Error("CLC 贴纸列表无效");
    }
    for (const sticker of card.stickers) {
      if (!sticker || typeof sticker !== "object") throw new Error("CLC 贴纸数据无效");
      const item = sticker as Record<string, unknown>;
      if (
        typeof item.id !== "string" ||
        typeof item.src !== "string" ||
        !/^data:image\/[a-z\d.+-]+;base64,[a-z\d+/]*={0,2}$/i.test(item.src) ||
        !["x", "y", "width", "aspectRatio", "rotation"].every(
          (key) => typeof item[key] === "number" && Number.isFinite(item[key]),
        )
      ) {
        throw new Error("CLC 贴纸数据无效");
      }
      if (
        Number(item.x) < 0 || Number(item.x) > 100 ||
        Number(item.y) < 0 || Number(item.y) > 100 ||
        Number(item.width) < 8 || Number(item.width) > 70 ||
        Number(item.aspectRatio) <= 0 || Number(item.aspectRatio) > 100
      ) {
        throw new Error("CLC 贴纸布局无效");
      }
    }
  }
}

function ensureCompressionSupport() {
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined") {
    throw new Error("当前环境不支持 CLC 压缩格式");
  }
}

async function transformStream(
  bytes: Uint8Array,
  format: "gzip",
  mode: "compress" | "decompress",
  maxOutputSize: number,
): Promise<Uint8Array> {
  const inputBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(inputBuffer).set(bytes);
  const stream = new Blob([inputBuffer]).stream();
  const transformed = mode === "compress"
    ? stream.pipeThrough(new CompressionStream(format))
    : stream.pipeThrough(new DecompressionStream(format));
  const reader = transformed.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxOutputSize) {
        await reader.cancel();
        throw new Error("CLC 解压后内容超过允许大小");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function encodeClc(value: PostcardData): Promise<Uint8Array> {
  ensureCompressionSupport();
  assertPostcardData(value);
  const payload = new TextEncoder().encode(JSON.stringify(value));
  if (payload.byteLength > MAX_CLC_PAYLOAD_SIZE) throw new Error("信件内容过大，无法保存为 CLC");
  const compressed = await transformStream(payload, "gzip", "compress", MAX_CLC_FILE_SIZE - HEADER_SIZE);
  const payloadBuffer = new ArrayBuffer(payload.byteLength);
  new Uint8Array(payloadBuffer).set(payload);
  const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", payloadBuffer));
  const result = new Uint8Array(HEADER_SIZE + compressed.byteLength);
  result.set(MAGIC, 0);
  const header = new DataView(result.buffer);
  header.setUint16(4, VERSION, true);
  header.setUint16(6, 1, true);
  header.setUint32(8, payload.byteLength, true);
  header.setUint32(12, compressed.byteLength, true);
  result.set(checksum, 16);
  result.set(compressed, HEADER_SIZE);
  return result;
}

export async function decodeClc(file: ArrayBuffer | Uint8Array): Promise<PostcardData> {
  ensureCompressionSupport();
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
  if (bytes.byteLength < HEADER_SIZE || bytes.byteLength > MAX_CLC_FILE_SIZE) {
    throw new Error("CLC 文件大小无效");
  }
  if (!MAGIC.every((byte, index) => bytes[index] === byte)) throw new Error("文件不是有效的 CLC 格式");
  const header = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  if (header.getUint16(4, true) !== VERSION) throw new Error("不支持此版本的 CLC 文件");
  if (header.getUint16(6, true) !== 1) throw new Error("CLC 压缩标记无效");
  const payloadSize = header.getUint32(8, true);
  const compressedSize = header.getUint32(12, true);
  if (
    payloadSize > MAX_CLC_PAYLOAD_SIZE ||
    compressedSize !== bytes.byteLength - HEADER_SIZE ||
    payloadSize === 0
  ) {
    throw new Error("CLC 文件长度信息无效");
  }
  let payload: Uint8Array;
  try {
    payload = await transformStream(bytes.subarray(HEADER_SIZE), "gzip", "decompress", MAX_CLC_PAYLOAD_SIZE);
  } catch (error) {
    const reason = error instanceof Error ? `：${error.message}` : "";
    throw new Error(`CLC 压缩数据无效或文件已损坏${reason}`);
  }
  if (payload.byteLength !== payloadSize) throw new Error("CLC 文件内容长度校验失败");
  const payloadBuffer = new ArrayBuffer(payload.byteLength);
  new Uint8Array(payloadBuffer).set(payload);
  const actualChecksum = new Uint8Array(await crypto.subtle.digest("SHA-256", payloadBuffer));
  if (!actualChecksum.every((byte, index) => byte === bytes[16 + index])) {
    throw new Error("CLC 文件完整性校验失败");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload));
  } catch {
    throw new Error("CLC 文件内容不是有效的 UTF-8 JSON");
  }
  assertPostcardData(parsed);
  return parsed;
}

export function getClcPayloadSize(file: Uint8Array): number {
  if (file.byteLength < HEADER_SIZE || !MAGIC.every((byte, index) => file[index] === byte)) {
    throw new Error("CLC 文件头无效");
  }
  const header = new DataView(file.buffer, file.byteOffset, HEADER_SIZE);
  const size = header.getUint32(8, true);
  if (header.getUint16(4, true) !== VERSION || size > MAX_CLC_PAYLOAD_SIZE) {
    throw new Error("CLC 文件版本或负载长度无效");
  }
  return size;
}

export function isPostcardData(value: unknown): value is PostcardData {
  try {
    assertPostcardData(value);
    return true;
  } catch {
    return false;
  }
}

export type { LetterSticker };
