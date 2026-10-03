export type StoryEpisodeCatalogEntry = {
  number: string;
  id?: string;
  title: string;
};

export type StoryCatalogEntry = {
  id: string;
  order: number;
  title: string;
  description: string;
  coverAsset?: string;
  seasonLabel: string;
  available: boolean;
  theme?: 'default' | 'gothic';
  episodes: readonly StoryEpisodeCatalogEntry[];
};

export const STORY_CATALOG: StoryCatalogEntry[] = [
  {
    id: 'last-online',
    order: 1,
    title: 'Последний онлайн',
    description: 'Новый город. Загадочный сосед. И сообщения с аккаунта девушки, исчезнувшей три года назад.',
    coverAsset: 'assets/last-online/cover.webp',
    seasonLabel: 'Сезон 1',
    available: true,
    episodes: [
      { number: '01', id: 'last-online-s1-e1', title: 'Номер, который не должен отвечать' },
      { number: '02', id: 'last-online-s1-e2', title: 'Тот, кого все знают' },
      { number: '03', id: 'last-online-s1-e3', title: 'Все лгут' },
      { number: '04', id: 'last-online-s1-e4', title: 'Ночь исчезновения' },
      { number: '05', id: 'last-online-s1-e5', title: 'Последний онлайн' },
    ],
  },
  {
    id: 'house-of-black-roses',
    order: 2,
    title: 'Дом чёрных роз',
    coverAsset: 'assets/house-of-black-roses/v1/ravenhall-exterior.webp',
    description: 'Старинное поместье. Три запрета. И портрет женщины, умершей 125 лет назад с твоим лицом.',
    seasonLabel: 'Сезон 1',
    available: true,
    theme: 'gothic',
    episodes: [
      { number: '01', id: 'house-of-black-roses-s1-e1', title: 'Наследница' },
      { number: '02', title: 'Западное крыло' },
      { number: '03', title: 'Чёрная роза' },
      { number: '04', title: 'Бал мёртвых' },
      { number: '05', title: 'Хозяйка Рейвенхолла' },
    ],
  },
];

export function getStoryCatalogEntry(storyId: string): StoryCatalogEntry {
  const story = STORY_CATALOG.find(candidate => candidate.id === storyId);
  if (!story) throw new Error(`Story not available: ${storyId}`);
  return story;
}
