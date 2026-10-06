import type { StageDimKind } from '../ui/stage-dim'
import { inject, onBeforeUnmount, onMounted } from 'vue'
import { STAGE_DIM, STAGE_DIM_KEY } from '../ui/stage-dim'

/**
 * На время жизни компонента просит StageScaler затемнить поля вокруг сцены (компонент затемняет саму сцену).
 * Вне StageScaler ничего не делает.
 */
export function useStageDim(kind: StageDimKind = STAGE_DIM.DIALOG): void {
  const stageDim = inject(STAGE_DIM_KEY, null)
  let release: (() => void) | undefined
  onMounted(() => {
    release = stageDim?.acquire(kind)
  })
  onBeforeUnmount(() => release?.())
}
