export interface SavedModel {
  id: string;
  name: string;
  savedAt: number;
  bytes: number;
  files: File[];
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('glb-studio-library', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('models', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error('Local storage is unavailable. You can still import files.'),
      );
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('models', mode),
      req = operation(tx.objectStore('models'));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          'Storage operation failed. Your browser may have reached its quota.',
        ),
      );
    };
  });
}
export async function listModels() {
  return (
    (await transaction('readonly', (store) => store.getAll())) as SavedModel[]
  ).sort((a, b) => b.savedAt - a.savedAt);
}
export async function saveModel(name: string, files: File[]) {
  const bytes = files.reduce((sum, f) => sum + f.size, 0),
    previous = await listModels();
  if (
    previous.length >= 10 ||
    previous.reduce((sum, m) => sum + m.bytes, 0) + bytes > 200 * 1024 * 1024
  )
    throw new Error(
      'Library limit reached (10 models / 200 MB). Remove a saved model first.',
    );
  // Preserve directory paths across structured cloning and future reopening.
  const paths = files.map(
    (file) =>
      new File([file], file.webkitRelativePath || file.name, {
        type: file.type,
      }),
  );
  await transaction('readwrite', (store) =>
    store.put({
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      bytes,
      files: paths,
    }),
  );
  // Persistence is best-effort; denial must not turn a committed save into failure.
  await navigator.storage?.persist?.().catch(() => false);
}
export function deleteModel(id: string) {
  return transaction('readwrite', (store) => store.delete(id));
}
