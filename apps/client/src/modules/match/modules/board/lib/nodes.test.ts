import type { GameState, PlayerId } from '@space/engine'
import { ABILITY_KIND, COMMAND_TYPE, createGame, legalActions, redact } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { CARD_FORM, CARD_STATE } from '@/modules/cards'
import { RECT } from '../../../lib/rects'
import { buildTable, indexLegalActions } from '../../table'
import { basePoses, boardLayout, DROP_ZONE, dropRects, fieldGeometry, handPoses, insideAny, layoutOf, opponentHandPoses, previewPlacement, shipPoses, tradeSlotPose } from './layout'
import { applyRoving, buildNodes, focusables, navigateTarget, NODE_CLICK, NODE_GROUP, NODE_KEY, NODE_ZONE } from './nodes'

function nodesFor(state: GameState, viewer: PlayerId, hoverKey: string | null = null) {
  const table = buildTable(redact(state, viewer))
  const legal = indexLegalActions(legalActions(state, viewer))
  return { table, nodes: buildNodes(table, { legal, interactive: true, hoverKey, selectedCardIds: [] }) }
}

/** Игрок 0 ходит первым; у него 3 карты в руке. */
function myTurnState(): GameState {
  const state = createGame(3, { firstPlayer: 0 })
  state.pools.trade = 2
  return state
}

describe('layout', () => {
  it('рука раскладывается симметрично вокруг центра поля, поднятая карта выпрямлена и выше остальных', () => {
    const poses = handPoses(5, 2)
    expect(poses[2]!.x).toBeCloseTo(958)
    expect(poses[0]!.x + poses[4]!.x).toBeCloseTo(1916)
    expect(poses[2]!.rot).toBe(0)
    expect(poses[2]!.z).toBeGreaterThan(poses[1]!.z)
    expect(poses[2]!.y).toBeLessThan(poses[1]!.y)
  })

  it('рука соперника - веер вокруг центра, центральная карта строго по центру', () => {
    const poses = opponentHandPoses(5)
    expect(poses[2]!.x).toBeCloseTo(958)
    expect(poses[2]!.rot).toBeCloseTo(0)
    expect(poses[0]!.rot).toBeGreaterThan(0)
  })

  it('слоты торгового ряда идут слева направо с фиксированным шагом', () => {
    const { trade } = boardLayout(true)
    expect(tradeSlotPose(trade, 1).x - tradeSlotPose(trade, 0).x).toBe(tradeSlotPose(trade, 4).x - tradeSlotPose(trade, 3).x)
  })

  it('в свой ход поле соперника вдвое ниже полного, а торговый ряд получает освободившееся место', () => {
    const mine = boardLayout(true)
    const theirs = boardLayout(false)
    expect(mine.opponentField.compact).toBe(true)
    expect(mine.selfField.compact).toBe(false)
    expect(theirs.opponentField.compact).toBe(false)
    expect(theirs.selfField.compact).toBe(true)
    expect(mine.opponentField.rect.h).toBeLessThan(theirs.opponentField.rect.h * 0.6)
    expect(mine.trade.rect.h).toBeGreaterThan(300)
    // Три блока заполняют колонку без дыр и наложений.
    for (const layout of [mine, theirs]) {
      expect(layout.opponentField.rect.y + layout.opponentField.rect.h + 12).toBe(layout.trade.rect.y)
      expect(layout.trade.rect.y + layout.trade.rect.h + 12).toBe(layout.selfField.rect.y)
      expect(layout.selfField.rect.y + layout.selfField.rect.h).toBe(792)
    }
  })

  it('сжатое поле - только базы: зоны кораблей нет, базы мельче и укладываются в его высоту', () => {
    const { opponentField } = boardLayout(true)
    const zone = fieldGeometry(opponentField, 2)
    expect(zone.shipsX).toBeNull()
    expect(zone.dividerX).toBeNull()
    const bases = basePoses(opponentField, 2)
    expect(bases[0]!.scale).toBeLessThan(0.5)
    expect(bases[0]!.y).toBe(opponentField.rect.y + opponentField.rect.h / 2)
    expect(200 * bases[0]!.scale).toBeLessThan(opponentField.rect.h)
  })

  it('в полном поле корабли идут правее баз', () => {
    const { selfField } = boardLayout(true)
    const bases = basePoses(selfField, 3)
    const ships = shipPoses(selfField, 2, 3)
    expect(ships[0]!.x).toBeGreaterThan(bases[2]!.x)
  })

  it('крупный просмотр - над картой, а если сверху нет места - под ней, и не выходит за сцену', () => {
    const stage = { w: 1920, h: 1080 }
    const low = previewPlacement({ x: 900, y: 700, rot: 0, scale: 0.66, z: 1, opacity: 1 }, 280, stage)
    expect(low.y).toBeLessThan(700)
    const high = previewPlacement({ x: 900, y: 200, rot: 0, scale: 0.66, z: 1, opacity: 1 }, 280, stage)
    expect(high.y).toBeGreaterThan(200)
    const edge = previewPlacement({ x: 5, y: 700, rot: 0, scale: 0.66, z: 1, opacity: 1 }, 280, stage)
    expect(edge.x).toBeGreaterThan(100)
  })

  it('раскладка зависит от того, чей ход', () => {
    const table = { you: 0, currentPlayer: 1 } as const
    expect(layoutOf(table)).toBe(boardLayout(false))
  })
})

describe('buildNodes', () => {
  it('в свой ход карты руки играются кликом, рука соперника - декоративные рубашки', () => {
    const state = myTurnState()
    const { table, nodes } = nodesFor(state, 0)
    const hand = nodes.filter(node => node.zone === NODE_ZONE.HAND)
    expect(hand).toHaveLength(table.self.hand.length)
    for (const node of hand) {
      expect(node.click).toMatchObject({ kind: NODE_CLICK.COMMAND, command: { type: COMMAND_TYPE.PLAY_CARD, cardId: node.key } })
    }

    const backs = nodes.filter(node => node.zone === NODE_ZONE.OPPONENT_HAND)
    expect(backs).toHaveLength(table.opponent.handCount)
    expect(backs.every(node => node.cardId === null && node.decorative && node.form === CARD_FORM.BACK)).toBe(true)
    expect(backs[0]!.key).toBe(NODE_KEY.opponentHand(0))
  })

  it('торговый ряд: доступные карты подсвечены, остальные приглушены, клик по доступной покупает', () => {
    const state = myTurnState()
    const { table, nodes } = nodesFor(state, 0)
    const row = nodes.filter(node => node.zone === NODE_ZONE.TRADE_ROW)
    expect(row).toHaveLength(5)
    const affordable = row.filter(node => node.state === CARD_STATE.AFFORDABLE)
    const unaffordable = row.filter(node => node.state === CARD_STATE.UNAFFORDABLE)
    expect(affordable.length + unaffordable.length).toBe(5)
    for (const node of affordable)
      expect(node.click).toMatchObject({ command: { type: COMMAND_TYPE.BUY, cardId: node.key } })
    for (const node of unaffordable)
      expect(node.click).toBeNull()
    expect(table.tradeRow.every(card => card !== null)).toBe(true)
  })

  it('в чужой ход ничего не кликабельно, а торговый ряд не подсвечивается', () => {
    const state = myTurnState()
    const { nodes } = nodesFor(state, 1)
    expect(nodes.every(node => node.click === null)).toBe(true)
    expect(nodes.filter(node => node.zone === NODE_ZONE.TRADE_ROW).every(node => node.state === CARD_STATE.IDLE)).toBe(true)
  })

  it('наведённая карта руки поднимается и получает рамку наведения', () => {
    const state = myTurnState()
    const table = buildTable(redact(state, 0))
    const target = table.self.hand[1]!.id
    const plain = nodesFor(state, 0).nodes.find(node => node.key === target)!
    const hovered = nodesFor(state, 0, target).nodes.find(node => node.key === target)!
    expect(hovered.state).toBe(CARD_STATE.HOVER)
    expect(hovered.pose.y).toBeLessThan(plain.pose.y)
  })

  it('чужой аванпост: чужие базы за ним закрыты, сам аванпост - цель, если хватает атаки', () => {
    const state = myTurnState()
    state.players[1].inPlay = [
      { card: { id: 'o1', cardId: 'battle-station' }, used: { [ABILITY_KIND.BASIC]: false, [ABILITY_KIND.ALLY]: false } },
      { card: { id: 'b1', cardId: 'blob-wheel' }, used: { [ABILITY_KIND.BASIC]: false, [ABILITY_KIND.ALLY]: false } },
    ]
    state.pools.combat = 5
    const { nodes } = nodesFor(state, 0)
    const outpost = nodes.find(node => node.key === 'o1')!
    const base = nodes.find(node => node.key === 'b1')!
    expect(outpost.state).toBe(CARD_STATE.TARGET)
    expect(outpost.click).toMatchObject({ command: { type: COMMAND_TYPE.ATTACK_BASE, cardId: 'o1' } })
    expect(base.state).toBe(CARD_STATE.LOCKED)
    expect(base.click).toBeNull()
    expect(base.form).toBe(CARD_FORM.DEPLOYED)
  })

  it('верх сброса виден двумя картами, свалка рисуется невидимыми узлами', () => {
    const state = myTurnState()
    state.players[0].discard = [{ id: 'd1', cardId: 'scout' }, { id: 'd2', cardId: 'scout' }, { id: 'd3', cardId: 'viper' }]
    state.scrapHeap = [{ id: 's1', cardId: 'scout' }]
    const { nodes } = nodesFor(state, 0)
    expect(nodes.filter(node => node.zone === NODE_ZONE.DISCARD).map(node => node.key)).toEqual(['d2', 'd3'])
    const scrapped = nodes.find(node => node.key === 's1')!
    expect(scrapped.pose.opacity).toBe(0)
  })
})

describe('перетаскивание', () => {
  it('сыграть можно перетащив карту руки на стол, купить - перетащив карту рынка на ваши колоды', () => {
    const state = myTurnState()
    const { nodes } = nodesFor(state, 0)
    const hand = nodes.find(node => node.zone === NODE_ZONE.HAND && node.drag)!
    expect(hand.drag).toMatchObject({ command: { type: COMMAND_TYPE.PLAY_CARD }, zone: DROP_ZONE.TABLE })
    // Команда у перетаскивания та же, что и у клика.
    expect(hand.click).toMatchObject({ command: hand.drag!.command })

    // Торговли 2: хватает на Исследователя, но не на дорогие карты ряда.
    const explorer = nodes.find(node => node.zone === NODE_ZONE.EXPLORERS)!
    expect(explorer.drag).toMatchObject({ command: { type: COMMAND_TYPE.BUY_EXPLORER }, zone: DROP_ZONE.OWN_SIDE })
    const expensive = nodes.filter(node => node.zone === NODE_ZONE.TRADE_ROW && !node.drag)
    expect(expensive.length).toBeGreaterThan(0)
    expect(expensive.every(node => node.click === null)).toBe(true)
  })

  it('зоны броска: стол выше руки; для покупки - нижняя полоса с колодами, рукой и панелью авторитета, но не ваше поле', () => {
    const field = boardLayout(true).selfField.rect
    const table = dropRects(DROP_ZONE.TABLE)
    expect(insideAny(table, 900, 300)).toBe(true)
    expect(insideAny(table, 900, RECT.SELF_HAND.y + 50)).toBe(false)

    const own = dropRects(DROP_ZONE.OWN_SIDE)
    expect(insideAny(own, field.x + 100, field.y + 50)).toBe(false)
    expect(insideAny(own, RECT.SELF_PILES.x + 50, RECT.SELF_PILES.y + 50)).toBe(true)
    expect(insideAny(own, RECT.SELF_PANEL.x + 50, RECT.SELF_PANEL.y + 50)).toBe(true)
    expect(insideAny(own, 900, 300)).toBe(false)
  })
})

describe('клавиатура', () => {
  it('в каждой группе в обход Tab входит одна карта: запомненная или крайняя левая', () => {
    const { nodes } = nodesFor(myTurnState(), 0)
    const hand = nodes.filter(node => node.group === NODE_GROUP.HAND && node.click)
    const rest = applyRoving(nodes, {})
    expect(rest.filter(node => node.group === NODE_GROUP.HAND && node.tabbable)).toHaveLength(1)
    expect(hand.length).toBeGreaterThan(1)
    const leftmost = [...hand].sort((a, b) => a.pose.x - b.pose.x)[0]!
    expect(leftmost.tabbable).toBe(true)

    const second = [...hand].sort((a, b) => a.pose.x - b.pose.x)[1]!
    applyRoving(nodes, { [NODE_GROUP.HAND]: second.key })
    expect(second.tabbable).toBe(true)
    expect(leftmost.tabbable).toBe(false)
  })

  it('стрелки: влево и вправо по группе, вверх и вниз между группами к ближайшей по горизонтали карте', () => {
    const { nodes } = nodesFor(myTurnState(), 0)
    const hand = focusables(nodes, NODE_GROUP.HAND)
    expect(navigateTarget(nodes, hand[0]!, 'ArrowLeft')).toBeNull()
    expect(navigateTarget(nodes, hand[0]!, 'ArrowRight')).toBe(hand[1])
    expect(navigateTarget(nodes, hand[0]!, 'End')).toBe(hand.at(-1))
    expect(navigateTarget(nodes, hand.at(-1)!, 'Home')).toBe(hand[0])

    const up = navigateTarget(nodes, hand[0]!, 'ArrowUp')
    expect(up?.group).toBe(NODE_GROUP.TRADE)
    // Из верхней группы вниз возвращаемся в руку; выше торгового ряда у нас никого нет.
    expect(navigateTarget(nodes, up!, 'ArrowDown')?.group).toBe(NODE_GROUP.HAND)
    expect(navigateTarget(nodes, up!, 'ArrowUp')).toBeNull()
  })

  it('узлы без клика (чужая рука, декор) в навигации не участвуют', () => {
    const { nodes } = nodesFor(myTurnState(), 0)
    expect(focusables(nodes, NODE_GROUP.HAND).every(node => node.click !== null)).toBe(true)
    expect(nodes.filter(node => node.zone === NODE_ZONE.OPPONENT_HAND).every(node => node.group === null)).toBe(true)
  })
})
