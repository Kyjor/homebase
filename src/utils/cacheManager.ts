export async function getCache<T>(key: string): Promise<T | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function removeCache(key: string): Promise<void> {
  localStorage.removeItem(key);
}
