import { box, position } from './types'

import invader_src from './invader.png'
import defender_src from './defender.png'
import explosion_src from './explosion.png'

export const h = 1000
export const w = 600

export const size = w / 20

export const create_canvas = (w: number, h: number) => {
  const main = document.createElement('canvas')
  main.width = w
  main.height = h

  const scene = main.getContext('2d')!
  const blank = scene.getImageData(0, 0, w, h)

  let layers: HTMLCanvasElement[] = []
  const compose = () => {
    scene.clearRect(0, 0, w, h)
    layers.forEach((layer) => scene.drawImage(layer, 0, 0))
  }

  return {
    main,
    scene,
    stack: (order: CanvasRenderingContext2D[]) => {
      layers = order.map((ctx) => ctx.canvas)
    },
    layer: () => {
      const layer = document.createElement('canvas')
      layer.width = w
      layer.height = h
      return layer.getContext('2d')!
    },
    draw: (
      ctx: CanvasRenderingContext2D,
      cb: (ctx: CanvasRenderingContext2D) => void
    ) => {
      ctx.reset()
      ctx.clearRect(0, 0, w, h)
      ctx.putImageData(blank, 0, 0)
      cb(ctx)
      compose()
    },
  }
}

export const draw_image = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource
) => ({
  at: (p: position) => ctx.drawImage(image, p.x, p.y, size, size),
})

export const point_in_box = (p: position, bb: box & position) =>
  bb.x <= p.x && p.x <= bb.x + bb.w && bb.y <= p.y && p.y <= bb.y + bb.h

export function throttle(fn: Function, window_time: number) {
  let last_call = 0
  return (...args: any[]) => {
    let time = Date.now()
    let time_since_last_call = time - last_call
    if (time_since_last_call >= window_time) {
      last_call = Date.now()
      fn(...args)
    }
  }
}

const load_image = (src: string) =>
  new Promise<HTMLImageElement>((resolve, _) => {
    const img = new Image(size, size)
    img.src = src
    img.onload = () => resolve(img)
  })

export const invader_image = await load_image(invader_src)

export const defender_image = await load_image(defender_src)

export const explosion_image = await load_image(explosion_src)
