import type { IconName } from '@/common/ui/icons'
import { ABILITY_KIND, CARDS } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { ICON } from '@/common/ui/icons'
import { abilityRows, TOKEN_KIND } from './card-meta'
import { ICON_LEGEND, LEGEND_SAMPLE } from './icon-legend'

const row = (cardId: string, kind: typeof ABILITY_KIND[keyof typeof ABILITY_KIND]) => abilityRows(cardId).find(item => item.kind === kind)!
function icons(cardId: string, kind: typeof ABILITY_KIND[keyof typeof ABILITY_KIND]) {
  return row(cardId, kind).chips.flatMap(token => (token.kind === TOKEN_KIND.CHIP ? [token.icon] : []))
}

describe('значки эффектов на картах', () => {
  it('уничтожение базы и корабль на верх колоды - только значок, без текста', () => {
    expect(icons('missile-mech', ABILITY_KIND.BASIC)).toContain(ICON.DESTROY_BASE)
    expect(row('missile-mech', ABILITY_KIND.BASIC).texts).toHaveLength(0)
    expect(icons('freighter', ABILITY_KIND.ALLY)).toEqual([ICON.DECK_TOP])
    expect(row('freighter', ABILITY_KIND.ALLY).texts).toHaveLength(0)
    expect(icons('central-office', ABILITY_KIND.BASIC)).toContain(ICON.DECK_TOP)
    expect(icons('blob-carrier', ABILITY_KIND.ALLY)).toEqual([ICON.ACQUIRE_SHIP])
  })

  it('соперник сбрасывает карту - значок с числом', () => {
    const [chip] = row('imperial-fighter', ABILITY_KIND.BASIC).chips.slice(1)
    expect(chip).toMatchObject({ icon: ICON.OPPONENT_DISCARD, value: '1' })
  })

  it('утилизация: значок с числом и текст «откуда»; из торгового ряда - отдельный значок без числа', () => {
    const own = row('trade-bot', ABILITY_KIND.BASIC)
    expect(own.chips[1]).toMatchObject({ icon: ICON.SCRAP, value: '1' })
    expect(own.texts).toMatchObject([{ label: 'из руки или сброса' }])

    const tradeRow = row('battle-pod', ABILITY_KIND.BASIC).chips[1]
    expect(tradeRow).toMatchObject({ icon: ICON.SCRAP_TRADE_ROW, value: undefined })
    expect(row('battle-pod', ABILITY_KIND.BASIC).texts).toHaveLength(0)
  })

  it('мозгомир: два утилизируемых и взять карту за каждую', () => {
    const brain = row('brain-world', ABILITY_KIND.BASIC)
    expect(brain.chips[0]).toMatchObject({ icon: ICON.SCRAP, value: '2' })
    expect(brain.texts).toMatchObject([{ label: 'Возьмите карту за каждую утилизированную' }])
  })

  it('посольская яхта: строка «+2 [карта] если от 2 [база]»', () => {
    const [line] = row('embassy-yacht', ABILITY_KIND.BASIC).texts
    expect(line).toMatchObject({ kind: TOKEN_KIND.LINE, parts: [{ text: '+2' }, { icon: ICON.DRAW }, { text: 'если от 2' }, { icon: ICON.BASE }] })
  })

  it('мир слизней: «+X» и условие текстом', () => {
    const world = row('blob-world', ABILITY_KIND.BASIC)
    expect(world.chips.at(-1)).toMatchObject({ icon: ICON.DRAW, value: '+X' })
    expect(world.texts).toMatchObject([{ label: 'за каждого сыгранного слизня' }])
  })

  it('каждая карта строится в токены без пустых значков', () => {
    for (const cardId of Object.keys(CARDS)) {
      for (const item of abilityRows(cardId)) {
        for (const token of item.chips) {
          if (token.kind === TOKEN_KIND.CHIP)
            expect(token.label, cardId).not.toBe('')
        }
      }
    }
  })
})

describe('условные обозначения', () => {
  it('в справке описан каждый значок эффектов, который рисуется на картах', () => {
    const described = new Set(ICON_LEGEND.flatMap(group => group.entries).flatMap(entry => (entry.sample.kind === LEGEND_SAMPLE.CHIP ? [entry.sample.icon] : [])))
    const onCards = new Set<IconName>()
    for (const cardId of Object.keys(CARDS)) {
      for (const item of abilityRows(cardId)) {
        for (const token of item.chips) {
          if (token.kind === TOKEN_KIND.CHIP)
            onCards.add(token.icon)
        }
      }
    }
    for (const icon of onCards)
      expect(described.has(icon), icon).toBe(true)
  })
})
