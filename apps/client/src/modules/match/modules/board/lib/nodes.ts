import type { CardInstance, Command, PlayedCard, ValueOf } from '@space/engine'
import type { LegalIndex, TableState } from '../../table'
import type { Pose } from './layout'
import type { AbilityStatus, CardForm, CardVisualState } from '@/modules/cards'
import { ABILITY_KIND, CARD_KIND, COMMAND_TYPE, getCard, PROMPT_KIND } from '@space/engine'
import { ABILITY_STATUS, CARD_FORM, CARD_STATE, cardName } from '@/modules/cards'
import { SIDE } from '../../table'
import {
  basePoses,
  explorersPose,
  handPoses,
  layoutOf,
  opponentDiscardPose,
  opponentHandPoses,
  scrapHeapPose,
  selfDiscardPose,
  shipPoses,
  tradeSlotPose,
} from './layout'

/** Ключи узлов, которых нет среди карт партии. Остальные узлы подписаны id экземпляра карты. */
export const NODE_KEY = {
  EXPLORERS_PILE: 'explorers-pile',
  opponentHand: (index: number): string => `opp-hand-${index}`,
} as const

/** Где карта лежит: нужно для подсказок и для того, чтобы отличать карту «в руке» от карты «на столе». */
export const NODE_ZONE = {
  HAND: 'hand',
  OPPONENT_HAND: 'opponent-hand',
  TRADE_ROW: 'trade-row',
  EXPLORERS: 'explorers',
  FIELD: 'field',
  DISCARD: 'discard',
  SCRAP: 'scrap',
} as const
export type NodeZone = ValueOf<typeof NODE_ZONE>

export const NODE_CLICK = {
  COMMAND: 'command',
  SELECT: 'select',
} as const

export type NodeClick
  = | { kind: typeof NODE_CLICK.COMMAND, command: Command }
    | { kind: typeof NODE_CLICK.SELECT, cardId: string }

export interface CardNode {
  key: string
  /** id экземпляра карты для команд; у синтетических узлов (рука соперника, пачка исследователей) null. */
  instanceId: string | null
  /** null - показывается рубашка. */
  cardId: string | null
  form: CardForm
  pose: Pose
  state: CardVisualState
  basic: AbilityStatus
  ally: AbilityStatus
  scrap: AbilityStatus
  zone: NodeZone
  /** Подпись для скринридера; пусто у декоративных узлов. */
  label: string
  /** Что делает клик; null - карта не кликабельна. */
  click: NodeClick | null
  /** Дополнительное действие «утилизировать» (кнопка у карты на столе). */
  scrapCommand: Command | null
  /** Поднимается при наведении. */
  liftable: boolean
  /** Нужна ли карта пользователю как кнопка (иначе - просто картинка поверх стола). */
  decorative: boolean
}

export interface NodeContext {
  legal: LegalIndex
  /** Принимается ли сейчас ввод: очередь анимаций пуста, партия не окончена, нет ожидающей команды. */
  interactive: boolean
  hoverKey: string | null
  /** Выбранная карта в prompt сброса (подтверждается кнопкой). */
  selectedCardId: string | null
}

const IDLE_ABILITIES = { basic: ABILITY_STATUS.AUTO, ally: ABILITY_STATUS.AUTO, scrap: ABILITY_STATUS.AUTO } as const

function baseNode(key: string, cardId: string | null, pose: Pose, zone: NodeZone): CardNode {
  return {
    key,
    instanceId: cardId === null ? null : key,
    cardId,
    form: cardId === null ? CARD_FORM.BACK : CARD_FORM.CARD,
    pose,
    state: CARD_STATE.IDLE,
    ...IDLE_ABILITIES,
    zone,
    label: '',
    click: null,
    scrapCommand: null,
    liftable: false,
    decorative: true,
  }
}

function cardNode(card: CardInstance, pose: Pose, zone: NodeZone): CardNode {
  return baseNode(card.id, card.cardId, pose, zone)
}

function handNodes(table: TableState, ctx: NodeContext): CardNode[] {
  const { hand } = table.self
  const hoverIndex = hand.findIndex(card => card.id === ctx.hoverKey)
  const poses = handPoses(hand.length, hoverIndex === -1 ? null : hoverIndex)
  const discarding = table.prompt?.kind === PROMPT_KIND.DISCARD && table.prompt.player === table.you

  return hand.map((card, index) => {
    const node = cardNode(card, poses[index]!, NODE_ZONE.HAND)
    node.liftable = true
    node.decorative = false
    node.label = `«${cardName(card.cardId)}» в руке`

    if (discarding && ctx.interactive && ctx.legal.promptCards.has(card.id)) {
      const selected = ctx.selectedCardId === card.id
      node.state = selected ? CARD_STATE.SELECTED : CARD_STATE.SELECTABLE
      node.click = { kind: NODE_CLICK.SELECT, cardId: card.id }
      node.label = `Сбросить «${cardName(card.cardId)}»`
    }
    else if (ctx.interactive && ctx.legal.playable.has(card.id)) {
      node.click = { kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.PLAY_CARD, cardId: card.id } }
      node.label = `Сыграть «${cardName(card.cardId)}»`
      if (ctx.hoverKey === card.id)
        node.state = CARD_STATE.HOVER
    }
    return node
  })
}

function opponentHandNodes(table: TableState): CardNode[] {
  const poses = opponentHandPoses(table.opponent.handCount)
  return poses.map((pose, index) => baseNode(NODE_KEY.opponentHand(index), null, pose, NODE_ZONE.OPPONENT_HAND))
}

function tradeRowNodes(table: TableState, ctx: NodeContext): CardNode[] {
  const myTurn = ctx.interactive && ctx.legal.canEndTurn
  const nodes: CardNode[] = []

  table.tradeRow.forEach((card, slot) => {
    if (!card)
      return
    const node = cardNode(card, tradeSlotPose(layoutOf(table).trade, slot), NODE_ZONE.TRADE_ROW)
    node.decorative = false
    const name = cardName(card.cardId)
    const affordable = ctx.legal.buyable.has(card.id)
    node.label = `«${name}» на рынке, цена ${getCard(card.cardId).cost}`
    if (myTurn) {
      node.state = affordable ? CARD_STATE.AFFORDABLE : CARD_STATE.UNAFFORDABLE
      node.label = affordable ? `Купить «${name}» за ${getCard(card.cardId).cost}` : `«${name}»: не хватает торговли`
    }
    if (ctx.interactive && affordable)
      node.click = { kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.BUY, cardId: card.id } }
    nodes.push(node)
  })

  if (table.explorersCount > 0) {
    const node = baseNode(NODE_KEY.EXPLORERS_PILE, 'explorer', explorersPose(layoutOf(table).trade), NODE_ZONE.EXPLORERS)
    node.instanceId = null
    node.decorative = false
    node.label = 'Исследователь'
    if (myTurn) {
      const affordable = ctx.legal.canBuyExplorer
      node.state = affordable ? CARD_STATE.AFFORDABLE : CARD_STATE.UNAFFORDABLE
      node.label = affordable ? 'Купить «Исследователя» за 2' : '«Исследователь»: не хватает торговли'
    }
    if (ctx.interactive && ctx.legal.canBuyExplorer)
      node.click = { kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.BUY_EXPLORER } }
    nodes.push(node)
  }
  return nodes
}

function abilityStatuses(entry: PlayedCard, mine: boolean, ctx: NodeContext): Pick<CardNode, 'basic' | 'ally' | 'scrap'> {
  const card = getCard(entry.card.cardId)
  const abilities = ctx.legal.activations.get(entry.card.id)
  let basic: AbilityStatus = ABILITY_STATUS.AUTO
  let ally: AbilityStatus = ABILITY_STATUS.AUTO

  // Базовая способность корабля срабатывает при розыгрыше, поэтому подсвечивать и приглушать её нет смысла.
  if (card.abilities[ABILITY_KIND.BASIC] && card.kind !== CARD_KIND.SHIP) {
    if (entry.used[ABILITY_KIND.BASIC])
      basic = ABILITY_STATUS.USED
    else if (mine && abilities?.has(ABILITY_KIND.BASIC))
      basic = ABILITY_STATUS.READY
  }
  if (card.abilities[ABILITY_KIND.ALLY]) {
    if (entry.used[ABILITY_KIND.ALLY])
      ally = ABILITY_STATUS.USED
    else if (mine && abilities?.has(ABILITY_KIND.ALLY))
      ally = ABILITY_STATUS.READY
    else if (mine)
      ally = ABILITY_STATUS.OFF
  }
  return { basic, ally, scrap: ABILITY_STATUS.AUTO }
}

function fieldNodes(table: TableState, ctx: NodeContext, side: typeof SIDE.SELF | typeof SIDE.OPPONENT): CardNode[] {
  const mine = side === SIDE.SELF
  const entries = table[side].inPlay
  const isShip = (entry: PlayedCard): boolean => getCard(entry.card.cardId).kind === CARD_KIND.SHIP
  const ships = entries.filter(isShip)
  const bases = entries.filter(entry => !isShip(entry))
  const layout = layoutOf(table)
  const frame = mine ? layout.selfField : layout.opponentField
  const shipSlots = shipPoses(frame, ships.length, bases.length)
  const baseSlots = basePoses(frame, bases.length)
  const opponentHasOutpost = table.opponent.inPlay.some(entry => getCard(entry.card.cardId).kind === CARD_KIND.OUTPOST)
  const myTurn = ctx.interactive && ctx.legal.canEndTurn

  const build = (entry: PlayedCard, pose: Pose, deployed: boolean): CardNode => {
    const node = cardNode(entry.card, pose, NODE_ZONE.FIELD)
    const name = cardName(entry.card.cardId)
    const card = getCard(entry.card.cardId)
    node.form = deployed ? CARD_FORM.DEPLOYED : CARD_FORM.CARD
    node.decorative = false
    node.label = `«${name}» на столе`
    Object.assign(node, abilityStatuses(entry, mine, ctx))

    if (mine) {
      const activations = ctx.legal.activations.get(entry.card.id)
      if (ctx.interactive && activations?.has(ABILITY_KIND.BASIC)) {
        node.click = { kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.ACTIVATE, cardId: entry.card.id, ability: ABILITY_KIND.BASIC } }
        node.label = `«${name}»: активировать основную способность`
      }
      else if (ctx.interactive && activations?.has(ABILITY_KIND.ALLY)) {
        node.click = { kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.ACTIVATE, cardId: entry.card.id, ability: ABILITY_KIND.ALLY } }
        node.label = `«${name}»: активировать союзную способность`
      }
      if (ctx.interactive && activations?.has(ABILITY_KIND.SCRAP))
        node.scrapCommand = { type: COMMAND_TYPE.ACTIVATE, cardId: entry.card.id, ability: ABILITY_KIND.SCRAP }
      if (node.click && ctx.hoverKey === node.key)
        node.state = CARD_STATE.HOVER
    }
    else if (ctx.interactive && ctx.legal.attackableBases.has(entry.card.id)) {
      node.state = CARD_STATE.TARGET
      node.click = { kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.ATTACK_BASE, cardId: entry.card.id } }
      node.label = `Атаковать «${name}», прочность ${card.defense ?? 0}`
    }
    else if (myTurn && card.kind !== CARD_KIND.OUTPOST && opponentHasOutpost) {
      node.state = CARD_STATE.LOCKED
      node.label = `«${name}» под защитой аванпоста`
    }
    return node
  }

  return [
    ...ships.map((entry, index) => build(entry, shipSlots[index]!, false)),
    ...bases.map((entry, index) => build(entry, baseSlots[index]!, true)),
  ]
}

/** В сбросе рисуются две верхние карты: нижняя нужна, пока новая карта летит на стопку. */
const VISIBLE_DISCARD = 2
const VISIBLE_SCRAP = 3

function pileNodes(table: TableState): CardNode[] {
  const nodes: CardNode[] = []
  const selfTop = table.self.discard.slice(-VISIBLE_DISCARD)
  selfTop.forEach((card, index) => nodes.push(cardNode(card, selfDiscardPose(index), NODE_ZONE.DISCARD)))
  const opponentTop = table.opponent.discard.slice(-VISIBLE_DISCARD)
  opponentTop.forEach((card, index) => nodes.push(cardNode(card, opponentDiscardPose(index), NODE_ZONE.DISCARD)))
  table.scrapHeap.slice(-VISIBLE_SCRAP).forEach(card => nodes.push(cardNode(card, scrapHeapPose(layoutOf(table).trade), NODE_ZONE.SCRAP)))
  return nodes
}

/** Все карты, которые должны быть нарисованы на столе, с позицией, видом и действием по клику. */
export function buildNodes(table: TableState, ctx: NodeContext): CardNode[] {
  return [
    ...handNodes(table, ctx),
    ...opponentHandNodes(table),
    ...tradeRowNodes(table, ctx),
    ...fieldNodes(table, ctx, SIDE.SELF),
    ...fieldNodes(table, ctx, SIDE.OPPONENT),
    ...pileNodes(table),
  ]
}

/** Подпись под картой Торгового ряда: «КУПИТЬ» или сколько торговли не хватает. */
export function tradeCaption(cost: number, tradePool: number, myTurn: boolean): { text: string, affordable: boolean } {
  if (!myTurn)
    return { text: '', affordable: false }
  return cost <= tradePool
    ? { text: 'КУПИТЬ', affordable: true }
    : { text: `НЕ ХВАТАЕТ ${cost - tradePool}`, affordable: false }
}
