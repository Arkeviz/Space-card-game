export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** Ближайшее к `point` положение левого верхнего угла элемента, при котором он целиком внутри окна. Если элемент больше окна - прижат к левому верхнему углу. */
export function clampToViewport(point: Point, element: Size, viewport: Size): Point {
  return {
    x: Math.min(Math.max(0, point.x), Math.max(0, viewport.width - element.width)),
    y: Math.min(Math.max(0, point.y), Math.max(0, viewport.height - element.height)),
  }
}
