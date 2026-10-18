import { decodeClc, encodeClc, getClcPayloadSize, isPostcardData, MAX_CLC_PAYLOAD_SIZE } from "./clc";
import type { PostcardData } from "./types/postcard";

const DATABASE_NAME = "caretellia-letter-history";
const DATABASE_VERSION = 2;
const LEGACY_KEY = "caretellia-postcards";
const MAX_HISTORY = 20;
const MAX_CACHE_SIZE = 128 * 1024 * 1024;
const MAX_VIEWED_FILES = 30;
const MAX_VIEWED_DATA_SIZE = 128 * 1024 * 1024;
const MIGRATION_KEY = "legacy-json-migrated-v1";

interface StoredLetter {
  id: string;
  data: Uint8Array;
  savedAt: number;
  rawSize?: number;
}

export interface ViewedFile {
  id: string;
  name: string;
  path: string | null;
  data: Uint8Array | null;
  viewedAt: number;
}

let databasePromise: Promise<IDBDatabase> | undefined;
let migrationPromise: Promise<void> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("letters")) {
        database.createObjectStore("letters", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata");
      }
      if (!database.objectStoreNames.contains("viewed-files")) {
        database.createObjectStore("viewed-files", { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("无法打开本机信件缓存"));
    request.onblocked = () => reject(new Error("信件缓存升级被其他窗口阻止，请关闭其他应用窗口后重试"));
  });
  const pending = opening.catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });
  databasePromise = pending;
  return pending;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("本机信件缓存操作失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("本机信件缓存操作已取消"));
  });
}

function normalizeLegacyCard(value: unknown): PostcardData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("旧版历史信件数据无效；原数据已保留");
  }
  const card = value as Record<string, unknown>;
  const normalized: unknown = {
    ...card,
    note: card.note === undefined ? "" : card.note,
    messageHtml: card.messageHtml === undefined ? "" : card.messageHtml,
    backCaptionHtml: card.backCaptionHtml === undefined ? "" : card.backCaptionHtml,
    stickers: card.stickers === undefined ? [] : card.stickers,
    titleFont: card.titleFont === undefined ? "Georgia" : card.titleFont,
    messageFont: card.messageFont === undefined ? "Georgia" : card.messageFont,
    captionFont: card.captionFont === undefined ? "Georgia" : card.captionFont,
    backCaptionFont: card.backCaptionFont === undefined ? "Georgia" : card.backCaptionFont,
    fromFont: card.fromFont === undefined ? "Georgia" : card.fromFont,
    toFont: card.toFont === undefined ? "Georgia" : card.toFont,
    stampFont: card.stampFont === undefined ? "Arial" : card.stampFont,
  };
  if (!isPostcardData(normalized)) throw new Error("旧版历史信件数据无效；原数据已保留");
  return normalized;
}

async function migrateLegacyHistory(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const database = await openDatabase();
    const checkTransaction = database.transaction("metadata", "readonly");
    const migrationRecord = await new Promise<unknown>((resolve, reject) => {
      const request = checkTransaction.objectStore("metadata").get(MIGRATION_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("无法读取信件缓存状态"));
    });
    await transactionDone(checkTransaction);
    if (migrationRecord) return;
    const raw = localStorage.getItem(LEGACY_KEY);
    const legacyCards: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(legacyCards)) throw new Error("旧版历史信件数据无效；原数据已保留");
    const cards = legacyCards.map(normalizeLegacyCard);
    const encoded: Uint8Array[] = [];
    for (const card of cards.slice(0, MAX_HISTORY)) {
      encoded.push(await encodeClc(card));
    }
    const migratedSize = encoded.reduce((total, data) => total + getClcPayloadSize(data), 0);
    if (migratedSize > MAX_CACHE_SIZE) {
      throw new Error("旧版历史信件超过本机缓存上限；原数据已保留");
    }
    const transaction = database.transaction(["letters", "metadata"], "readwrite");
    const letters = transaction.objectStore("letters");
    const savedAt = Date.now();
    cards.slice(0, MAX_HISTORY).forEach((card, index) => {
      letters.put({
        id: card.id,
        data: encoded[index],
        savedAt: savedAt - index,
        rawSize: getClcPayloadSize(encoded[index]),
      } satisfies StoredLetter);
    });
    transaction.objectStore("metadata").put(true, MIGRATION_KEY);
    await transactionDone(transaction);
    if (raw !== null) localStorage.removeItem(LEGACY_KEY);
  })().catch((error: unknown) => {
    migrationPromise = undefined;
    throw error;
  });
  return migrationPromise;
}

async function ensureReady(): Promise<IDBDatabase> {
  const database = await openDatabase();
  await migrateLegacyHistory();
  return database;
}

export async function listHistory(): Promise<PostcardData[]> {
  const database = await ensureReady();
  const transaction = database.transaction("letters", "readonly");
  const request = transaction.objectStore("letters").getAll() as IDBRequest<StoredLetter[]>;
  const records = await new Promise<StoredLetter[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法读取历史信件"));
  });
  await transactionDone(transaction);
  const sorted = records
    .sort((first, second) => (second.savedAt ?? 0) - (first.savedAt ?? 0))
    .slice(0, MAX_HISTORY);
  let totalSize = 0;
  const cards: PostcardData[] = [];
  const repairedRecords: StoredLetter[] = [];
  for (const record of sorted) {
    const rawSize = getClcPayloadSize(record.data);
    totalSize += rawSize;
    if (totalSize > MAX_CACHE_SIZE) throw new Error("历史信件缓存超过本机读取上限");
    cards.push(await decodeClc(record.data));
    if (record.rawSize !== rawSize) repairedRecords.push({ ...record, rawSize });
  }
  if (repairedRecords.length > 0) {
    const repairTransaction = database.transaction("letters", "readwrite");
    const store = repairTransaction.objectStore("letters");
    repairedRecords.forEach((record) => store.put(record));
    await transactionDone(repairTransaction);
  }
  return cards;
}

export async function saveHistoryCard(card: PostcardData): Promise<void> {
  const data = await encodeClc(card);
  const rawSize = getClcPayloadSize(data);
  if (rawSize > MAX_CACHE_SIZE || rawSize > MAX_CLC_PAYLOAD_SIZE) {
    throw new Error("信件超过本机缓存大小限制");
  }
  const database = await ensureReady();
  const transaction = database.transaction("letters", "readwrite");
  const store = transaction.objectStore("letters");
  const request = store.getAll() as IDBRequest<StoredLetter[]>;
  let cacheLimitExceeded = false;
  request.onsuccess = () => {
    const records = request.result;
    const totalSize = records.reduce(
      (total, record) => total + (record.id === card.id ? 0 : getClcPayloadSize(record.data)),
      0,
    );
    if (totalSize + rawSize > MAX_CACHE_SIZE) {
      cacheLimitExceeded = true;
      transaction.abort();
      return;
    }
    const savedAt = Math.max(Date.now(), ...records.map((record) => record.savedAt + 1));
    store.put({ id: card.id, data, savedAt, rawSize } satisfies StoredLetter);
    [...records.filter((record) => record.id !== card.id), { id: card.id, data, savedAt, rawSize }]
      .sort((first, second) => second.savedAt - first.savedAt)
      .slice(MAX_HISTORY)
      .forEach((record) => store.delete(record.id));
  };
  try {
    await transactionDone(transaction);
  } catch (error) {
    if (cacheLimitExceeded) {
      throw new Error("本机历史缓存已达到大小上限，请先删除旧信件");
    }
    throw error;
  }
}

export async function deleteHistoryCard(id: string): Promise<void> {
  const database = await ensureReady();
  const transaction = database.transaction("letters", "readwrite");
  transaction.objectStore("letters").delete(id);
  await transactionDone(transaction);
}

export async function listViewedFiles(limit = 10): Promise<ViewedFile[]> {
  const database = await ensureReady();
  const transaction = database.transaction("viewed-files", "readonly");
  const request = transaction.objectStore("viewed-files").getAll() as IDBRequest<ViewedFile[]>;
  const files = await new Promise<ViewedFile[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法读取最近查看的文件"));
  });
  await transactionDone(transaction);
  const sorted = files.sort((first, second) => second.viewedAt - first.viewedAt);
  const maximum = Math.min(MAX_VIEWED_FILES, Math.max(0, Math.trunc(limit)));
  const hiddenIds = sorted.slice(maximum).map((file) => file.id);
  if (hiddenIds.length > 0) {
    const cleanup = database.transaction("viewed-files", "readwrite");
    const store = cleanup.objectStore("viewed-files");
    hiddenIds.forEach((id) => store.delete(id));
    await transactionDone(cleanup);
  }
  return sorted.slice(0, maximum);
}

export async function rememberViewedFile(
  file: Omit<ViewedFile, "viewedAt">,
  limit = 10,
): Promise<void> {
  const database = await ensureReady();
  const transaction = database.transaction("viewed-files", "readwrite");
  const store = transaction.objectStore("viewed-files");
  const request = store.getAll() as IDBRequest<ViewedFile[]>;
  let storageLimitExceeded = false;
  request.onsuccess = () => {
    const current = request.result;
    const otherDataSize = current.reduce(
      (total, item) => total + (item.id === file.id ? 0 : item.data?.byteLength ?? 0),
      0,
    );
    if (otherDataSize + (file.data?.byteLength ?? 0) > MAX_VIEWED_DATA_SIZE) {
      storageLimitExceeded = true;
      transaction.abort();
      return;
    }
    const viewedAt = Date.now();
    const updated = { ...file, viewedAt } satisfies ViewedFile;
    store.put(updated);
    [...current.filter((item) => item.id !== file.id), updated]
      .sort((first, second) => second.viewedAt - first.viewedAt)
      .slice(Math.min(MAX_VIEWED_FILES, Math.max(0, Math.trunc(limit))))
      .forEach((item) => store.delete(item.id));
  };
  try {
    await transactionDone(transaction);
  } catch (error) {
    if (storageLimitExceeded) throw new Error("最近查看的本地文件副本已达到存储上限");
    throw error;
  }
}

export async function deleteViewedFile(id: string): Promise<void> {
  const database = await ensureReady();
  const transaction = database.transaction("viewed-files", "readwrite");
  transaction.objectStore("viewed-files").delete(id);
  await transactionDone(transaction);
}
