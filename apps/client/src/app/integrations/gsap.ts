import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { Flip } from 'gsap/Flip'

export function setupGsap() {
  gsap.registerPlugin(Flip, Draggable)
}
