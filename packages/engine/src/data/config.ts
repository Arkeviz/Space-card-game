export const EXPLORER_COUNT = 10
export const TRADE_ROW_SIZE = 5
export const STARTING_AUTHORITY = 50
export const HAND_SIZE = 5
/** Первый игрок в свой первый ход берёт 3 карты, второй - 5. */
export const FIRST_PLAYER_STARTING_HAND = 3

export const STARTING_DECK: Readonly<Record<string, number>> = { scout: 8, viper: 2 }

/** Состав Торговой колоды: все 80 карт базового набора (по 20 на фракцию). */
export const TRADE_DECK_COMPOSITION: Readonly<Record<string, number>> = {
  // Торговая федерация
  'federation-shuttle': 3,
  'cutter': 3,
  'embassy-yacht': 2,
  'freighter': 2,
  'trade-escort': 1,
  'flagship': 1,
  'command-ship': 1,
  'trading-post': 2,
  'barter-world': 2,
  'defense-center': 1,
  'port-of-call': 1,
  'central-office': 1,
  // Слизни
  'blob-fighter': 3,
  'trade-pod': 3,
  'battle-pod': 2,
  'ram': 2,
  'blob-destroyer': 2,
  'battle-blob': 1,
  'blob-carrier': 1,
  'mothership': 1,
  'blob-wheel': 3,
  'the-hive': 1,
  'blob-world': 1,
  // Технокульт
  'trade-bot': 3,
  'missile-bot': 3,
  'supply-bot': 3,
  'battle-station': 2,
  'patrol-mech': 2,
  'stealth-needle': 1,
  'battle-mech': 1,
  'missile-mech': 1,
  'mech-world': 1,
  'brain-world': 1,
  'machine-base': 1,
  'junkyard': 1,
  // Звёздная империя
  'imperial-fighter': 3,
  'imperial-frigate': 3,
  'survey-ship': 3,
  'corvette': 2,
  'battlecruiser': 1,
  'dreadnaught': 1,
  'space-station': 2,
  'recycling-station': 2,
  'war-world': 1,
  'royal-redoubt': 1,
  'fleet-hq': 1,
}
