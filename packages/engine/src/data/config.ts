export const EXPLORER_COUNT = 10
export const TRADE_ROW_SIZE = 5
export const STARTING_AUTHORITY = 50
export const HAND_SIZE = 5
/** Первый игрок в свой первый ход берёт 3 карты, второй - 5. */
export const FIRST_PLAYER_STARTING_HAND = 3

export const STARTING_DECK: Readonly<Record<string, number>> = { scout: 8, viper: 2 }

/** Состав Торговой колоды. Пока это подмножество базового набора, покрывающее все механики. */
export const TRADE_DECK_COMPOSITION: Readonly<Record<string, number>> = {
  // Торговая федерация
  'federation-shuttle': 3,
  'cutter': 3,
  'trading-post': 2,
  'barter-world': 2,
  // Слизь
  'blob-fighter': 3,
  'battle-pod': 2,
  'trade-pod': 3,
  'blob-wheel': 3,
  'ram': 2,
  'blob-destroyer': 2,
  'the-hive': 1,
  'battle-blob': 1,
  'blob-carrier': 1,
  'mothership': 1,
  'blob-world': 1,
  // Технокульт
  'trade-bot': 3,
  'battle-station': 2,
  'machine-base': 1,
  // Звёздная империя
  'imperial-fighter': 3,
  'corvette': 2,
  'royal-redoubt': 1,
}
