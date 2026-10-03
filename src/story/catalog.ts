export type StoryCatalogEntry = {
  id: string;
  title: string;
  description: string;
  coverAsset: string;
  seasonLabel: string;
  available: boolean;
};

export const STORY_CATALOG: StoryCatalogEntry[] = [
  {
    id: 'last-online',
    title: 'Последний онлайн',
    description: 'Новый город. Загадочный сосед. И сообщения с аккаунта девушки, исчезнувшей три года назад.',
    coverAsset: 'assets/last-online/cover.webp',
    seasonLabel: 'Сезон 1',
    available: true,
  },
];

// Следующие истории добавляются сюда отдельными карточками.
// Пока контент не готов, используйте available: false.
