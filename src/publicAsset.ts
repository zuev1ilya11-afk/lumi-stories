export function publicAsset(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedPath = path.replace(/^\/+/, '');
  const normalizedBase = baseUrl || '/';
  return normalizedBase.endsWith('/')
    ? `${normalizedBase}${normalizedPath}`
    : `${normalizedBase}/${normalizedPath}`;
}
