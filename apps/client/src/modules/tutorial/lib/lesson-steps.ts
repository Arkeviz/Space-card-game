import type { GameState } from '@space/engine'
import type { LessonStep, TargetSpec } from './lesson-types'
import { ABILITY_KIND, COMMAND_TYPE } from '@space/engine'
import { anchorSelector, cardSelector, DIALOG_SELECTOR, TOUR_ANCHOR } from '@/common/utilities/tour-anchors'
import { TOUR_SIDE } from '@/common/utilities/tour-placement'
import { activating, attackPlayer, buy, buyExplorer, buying, commandOf, endTurn, findInHand, findInPlay, findInRow, play, playing } from './lesson-helpers'
import { STEP_KIND } from './lesson-types'

/*
 * Сценарий обучения: подсказки, действия игрока и записанные ходы соперника. Партия описана в lesson-game.ts;
 * здесь порядок такой: ход 1 игрока (карты, покупка, атака), ход соперника, ход 3 (база), ход соперника
 * с аванпостом, ход 5 (союзник и разрушение аванпоста).
 */

const ME = 0
const OPPONENT = 1

const anchor = anchorSelector

function handCard(cardId: string): TargetSpec {
  return (state: GameState) => {
    const card = findInHand(state, ME, cardId)
    return card ? cardSelector(card.id) : anchor(TOUR_ANCHOR.HAND)
  }
}
const firstHandCard: TargetSpec = (state: GameState) => {
  const card = state.players[ME].hand[0]
  return card ? cardSelector(card.id) : anchor(TOUR_ANCHOR.HAND)
}
function rowCard(cardId: string): TargetSpec {
  return (state: GameState) => {
    const card = findInRow(state, cardId)
    return card ? cardSelector(card.id) : anchor(TOUR_ANCHOR.TRADE_ROW)
  }
}
function fieldCard(player: 0 | 1, cardId: string): TargetSpec {
  return (state: GameState) => {
    const card = findInPlay(state, player, cardId)
    return card ? cardSelector(card.id) : null
  }
}

const handIsEmpty = (state: GameState): boolean => state.players[ME].hand.length === 0
const noCombatLeft = (state: GameState): boolean => state.pools.combat === 0

export const LESSON_STEPS: readonly LessonStep[] = [
  // Знакомство с экраном
  {
    id: 'welcome',
    kind: STEP_KIND.INFO,
    title: 'Добро пожаловать!',
    text: 'В рамках этой партии вас обучат основам игры Звездные Империи',
    nextLabel: 'Начать',
  },
  {
    id: 'goal',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.OPPONENT_PANEL),
    side: TOUR_SIDE.LEFT,
    title: 'Цель игры',
    text: 'У каждого игрока по 50 очков авторитета. Побеждает тот, кто первым обнулит авторитет соперника. Вот он, справа-сверху.',
  },
  {
    id: 'self',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.SELF_PANEL),
    side: TOUR_SIDE.LEFT,
    title: 'Ваш авторитет',
    text: 'А это вы. Атаки соперника отнимают ваш авторитет, а некоторые карты его восстанавливают.',
  },
  {
    id: 'hand',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.HAND),
    side: TOUR_SIDE.TOP,
    title: 'Ваша рука',
    text: 'Эти карты можно сыграть в свой ход. В первый ход первый игрок берёт 3 карты, второй - 5. Вы ходите первым.',
  },
  {
    id: 'market',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.TRADE_ROW),
    side: TOUR_SIDE.TOP,
    title: 'Торговый ряд',
    text: 'Общий рынок: 5 карт, которые покупают за торговлю. Цена написана в левом-верхнем углу карты. Купленная карта уходит в ваш сброс, а на её место выкладывается новая.',
  },
  {
    id: 'explorers',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.EXPLORERS),
    side: TOUR_SIDE.BOTTOM,
    title: 'Исследователи',
    text: 'Эта стопка всегда под рукой: пригодится, когда на рынке нет ничего подходящего.',
  },
  {
    id: 'pools',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.POOLS),
    side: TOUR_SIDE.LEFT,
    title: 'Торговля и атака',
    text: 'Сыгранные карты копят здесь два ресурса: торговлю (жёлтая) для покупок и атаку (красная) для ударов. В конце хода остаток сгорает.',
  },

  // Ход 1: карты, покупка, атака
  {
    id: 'play-first',
    kind: STEP_KIND.ACT,
    target: firstHandCard,
    side: TOUR_SIDE.TOP,
    title: 'Сыграйте карту',
    text: 'Нажмите на карту в руке или перетащите её на стол. Разведчик даёт 1 торговлю, Штурмовик - 1 атаку.',
    allow: playing(),
  },
  {
    id: 'play-rest',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.PLAY_ALL),
    side: TOUR_SIDE.LEFT,
    title: 'Остальные карты',
    text: 'Сыграйте и остальные. Быстрее всего кнопка «Разыграть все» или клавиша P.',
    allow: playing(),
    until: handIsEmpty,
  },
  {
    id: 'buy',
    kind: STEP_KIND.ACT,
    target: rowCard('cutter'),
    side: TOUR_SIDE.TOP,
    title: 'Покупка',
    text: 'У вас 2 торговли. Купите Катер за 2: нажмите на карту или перетащите её вниз, к руке. Купленная карта уйдёт в сброс и вернётся в руку позже.',
    allow: buying('cutter'),
  },
  {
    id: 'attack',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.ATTACK),
    side: TOUR_SIDE.LEFT,
    title: 'Атака',
    text: 'Оставшуюся атаку потратьте на соперника: нажмите «Атаковать» (A) или на его аватар. Каждое очко атаки отнимает 1 авторитета.',
    allow: commandOf(COMMAND_TYPE.ATTACK_PLAYER),
  },
  {
    id: 'end-turn',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.END_TURN),
    side: TOUR_SIDE.LEFT,
    title: 'Конец хода',
    text: 'Больше делать нечего. Сыгранные карты уйдут в сброс, а вы возьмёте 5 новых. Нажмите «Конец хода» (E).',
    allow: commandOf(COMMAND_TYPE.END_TURN),
  },
  {
    id: 'opponent-1',
    kind: STEP_KIND.AUTO,
    target: anchor(TOUR_ANCHOR.TURN_PANEL),
    side: TOUR_SIDE.LEFT,
    title: 'Ход соперника',
    text: 'Теперь ходит соперник. Его рука скрыта, но сыгранные карты вы видите. Все действия записывается в журнал боя слева.',
    moves: [
      play('scout'),
      play('scout'),
      play('scout'),
      play('viper'),
      play('viper'),
      buy('imperial-frigate'),
      attackPlayer,
      endTurn,
    ],
  },

  // Ход 3: колода, сброс, база
  {
    id: 'turn-3',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.HAND),
    side: TOUR_SIDE.TOP,
    title: 'Снова ваш ход',
    text: 'Соперник ударил вас на 2 и купил Имперский фрегат: на рынке появилась новая карта. У вас новая рука из 5 карт.',
  },
  {
    id: 'piles',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.SELF_PILES),
    side: TOUR_SIDE.RIGHT,
    title: 'Колода и сброс',
    text: 'Новые карты берутся из колоды. Когда она кончается, сброс перетасовывается и становится новой колодой: так купленные карты попадают в руку.',
  },
  {
    id: 'play-all-3',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.PLAY_ALL),
    side: TOUR_SIDE.LEFT,
    title: 'Разыграйте руку',
    text: 'Разыграйте своих разведчиков кнопкой «Разыграть все» или клавишей P.',
    allow: playing(),
    until: handIsEmpty,
  },
  {
    id: 'buy-base',
    kind: STEP_KIND.ACT,
    target: rowCard('barter-world'),
    side: TOUR_SIDE.TOP,
    title: 'Купите базу',
    text: 'Рыночный мир - база. В отличие от кораблей, база остаётся на вашем поле и работает каждый ход, пока её не уничтожат.',
    allow: buying('barter-world'),
  },
  {
    id: 'end-turn-3',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.END_TURN),
    side: TOUR_SIDE.LEFT,
    title: 'Конец хода',
    text: 'Одна торговля осталась, но на неё ничего не купить: на рынке всё дороже. Заканчивайте ход.',
    allow: commandOf(COMMAND_TYPE.END_TURN),
  },
  {
    id: 'opponent-2',
    kind: STEP_KIND.AUTO,
    target: anchor(TOUR_ANCHOR.TURN_PANEL),
    side: TOUR_SIDE.LEFT,
    title: 'Ход соперника',
    text: 'Соперник выкладывает аванпост и покупает Исследователей. Посмотрите на его поле: аванпост пригодится нам в следующем ходу.',
    moves: [
      play('recycling-station'),
      play('scout'),
      play('scout'),
      play('scout'),
      play('scout'),
      buyExplorer,
      buyExplorer,
      endTurn,
    ],
  },

  // Ход 5: союзник, аванпост
  {
    id: 'turn-5',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.HAND),
    side: TOUR_SIDE.TOP,
    title: 'Колода перетасована',
    text: 'Колода закончилась, сброс перемешался, и к вам вернулись Катер и Рыночный мир. Обе карты принадлежат Торговой федерации (синий цвет), чудесно-чудесно, но об этом позже :)',
  },
  {
    id: 'outpost',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.OPPONENT_FIELD),
    side: TOUR_SIDE.BOTTOM,
    title: 'Аванпост соперника',
    text: 'Станция переработки - аванпост с защитой 4. Пока стоит аванпост, бить соперника и его обычные базы нельзя: сначала аванпост нужно уничтожить.',
  },
  {
    id: 'play-base',
    kind: STEP_KIND.ACT,
    target: handCard('barter-world'),
    side: TOUR_SIDE.TOP,
    title: 'Выложите базу',
    text: 'Сыграйте Рыночный мир: база ляжет на ваше поле.',
    allow: playing('barter-world'),
  },
  {
    id: 'activate-base',
    kind: STEP_KIND.ACT,
    target: fieldCard(ME, 'barter-world'),
    side: TOUR_SIDE.TOP,
    title: 'Эффект базы',
    text: 'Простые эффекты баз срабатывают сами, а эффекты с выбором включаются вручную. Нажмите на базу.',
    allow: activating('barter-world', ABILITY_KIND.BASIC),
  },
  {
    id: 'choose',
    kind: STEP_KIND.ACT,
    target: DIALOG_SELECTOR,
    side: TOUR_SIDE.RIGHT,
    title: 'Выбор эффекта',
    text: 'Рыночный мир даёт на выбор +2 торговли или +2 авторитета. Подойдёт любой вариант.',
    allow: commandOf(COMMAND_TYPE.CHOOSE_OPTION),
  },
  {
    id: 'ally',
    kind: STEP_KIND.ACT,
    target: handCard('cutter'),
    side: TOUR_SIDE.TOP,
    title: 'Союзник',
    text: 'Когда на столе две карты одной фракции, у них включается способность союзника. Рыночный мир уже на поле: сыграйте Катер.',
    allow: playing('cutter'),
  },
  {
    id: 'ally-result',
    kind: STEP_KIND.INFO,
    target: anchor(TOUR_ANCHOR.POOLS),
    side: TOUR_SIDE.LEFT,
    title: 'Способность союзника',
    text: 'Катер дал 4 авторитета и 2 торговли, а как союзник Рыночного мира ещё и 4 атаки. Такие способности срабатывают сами.',
  },
  {
    id: 'play-rest-5',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.PLAY_ALL),
    side: TOUR_SIDE.LEFT,
    title: 'Остальные карты',
    text: 'Сыграйте оставшиеся карты',
    allow: playing(),
    until: handIsEmpty,
  },
  {
    id: 'destroy-outpost',
    kind: STEP_KIND.ACT,
    target: fieldCard(OPPONENT, 'recycling-station'),
    side: TOUR_SIDE.BOTTOM,
    title: 'Уничтожьте аванпост',
    text: 'У вас 5 атаки, а защита аванпоста 4. Нажмите на него: атака потратится, а аванпост уйдёт в сброс соперника.',
    allow: commandOf(COMMAND_TYPE.ATTACK_BASE),
  },
  {
    id: 'attack-face',
    kind: STEP_KIND.ACT,
    target: anchor(TOUR_ANCHOR.ATTACK),
    side: TOUR_SIDE.LEFT,
    title: 'Удар по сопернику',
    text: 'Аванпоста больше нет, и оставшуюся атаку можно направить прямо на соперника.',
    allow: commandOf(COMMAND_TYPE.ATTACK_PLAYER),
    skipIf: noCombatLeft,
  },
  {
    id: 'outro',
    kind: STEP_KIND.INFO,
    title: 'Обучение пройдено!',
    text: 'Вы разыграли карты, купили корабль и базу, использовали союзное свойство и уничтожили аванпост. Остальное узнаете в бою: утилизация карт и способности фракций описаны в справке (клавиша ?), а все карты можно посмотреть в каталоге. Удачи!',
    nextLabel: 'В главное меню',
  },
]
