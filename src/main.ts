import './style.css'
import type { box, position } from './types'
import {
  w,
  h,
  create_canvas,
  draw_image,
  point_in_box,
  size,
  throttle,
  defender_image,
  explosion_image,
  invader_image,
} from './utils'

const { main, draw, stack, layer } = create_canvas(w, h + size)

const mega_layer = layer()
const bullets_layer = layer()

stack([mega_layer, bullets_layer])

let lives = 3
let score = 0
const hiscore_key = 'hiscore'
let hiscore = +(localStorage.getItem(hiscore_key) || 0)

let invader_bullets: Array<position> = []
let defender_bullets: Array<position> = []

const nbarriers = 4
const gap_width = 2 * size
const ngaps = nbarriers - 1 + 2
const barrier_width = (w - ngaps * gap_width) / nbarriers
const barriers: Array<position & box & { hits_left: number }> = []
for (let n = 0, x = 0; n < nbarriers; x += barrier_width, n++) {
  barriers.push({
    x: (x += gap_width),
    y: h * 0.75,
    w: barrier_width,
    h: size / 2,
    hits_left: 5,
  })
}

let explosions: Array<position> = []

const defender: Pick<position, 'x'> & { readonly y: number } & box = {
  x: w / 2 - size / 2,
  y: h - size,
  w: size,
  h: size / 2,
}

document.addEventListener('keydown', (e) => {
  defender.x += e.code == 'ArrowLeft' ? -3 : e.key == 'ArrowRight' ? 3 : 0
  defender.x =
    defender.x < 0
      ? 0
      : defender.x > w - defender.w
      ? w - defender.w
      : defender.x
})

function shoot(e: KeyboardEvent) {
  if (e.code == 'Space') {
    defender_bullets.push({
      y: defender.y,
      x: defender.x + size / 2,
    })
  }
}

document.addEventListener('keydown', throttle(shoot, 500))

let invaders: Array<position & box> = []
const invader_gap = size * 0.4
for (let r = 0, y = 0; r < 3; r++, y += invader_gap + size) {
  for (
    let c = 0, x = w / 2 - (8 * size + invader_gap * 7) / 2;
    c < 8;
    c++, x += invader_gap + size
  ) {
    invaders.push({
      x,
      y,
      w: size,
      h: size,
    })
  }
}

let game_over = false

let previous_time = Date.now()
let last_shot = Date.now()

let bullet_speed = h / (10 * 1000)
let invader_speed = h / (75 * 1000)

function game() {
  const now = Date.now()
  const dt = now - previous_time
  previous_time = Date.now()

  const bullet_dy = dt * bullet_speed

  for (const bullet of invader_bullets) bullet.y += bullet_dy
  for (const bullet of defender_bullets) bullet.y -= bullet_dy

  collisions: {
    const blocked_by_barrier: position[] = []
    for (const barrier of barriers) {
      if (barrier.hits_left > 0) {
        for (const bullet of invader_bullets) {
          if (point_in_box(bullet, barrier)) {
            barrier.hits_left--
            blocked_by_barrier.push(bullet)
          }
        }
      }
    }
    invader_bullets = invader_bullets.filter(
      (bullet) => !blocked_by_barrier.includes(bullet)
    )

    const shots_landed: position[] = []
    const destroyed_invaders: typeof invaders = []

    for (const invader of invaders) {
      for (const bullet of defender_bullets) {
        if (point_in_box(bullet, invader)) {
          hiscore = Math.max((score += 10), hiscore)
          localStorage.setItem(hiscore_key, String(hiscore))

          shots_landed.push(bullet)
          destroyed_invaders.push(invader)

          const explosion = { y: invader.y, x: invader.x }
          setTimeout(
            () => (explosions = explosions.filter((e) => e != explosion)),
            1500
          )
          explosions.push(explosion)
        }
      }
    }
    invaders = invaders.filter(
      (invader) => !destroyed_invaders.includes(invader)
    )
    defender_bullets = defender_bullets.filter(
      (bullet) => !shots_landed.includes(bullet)
    )

    const blows_taken: position[] = []
    for (const bullet of invader_bullets) {
      if (point_in_box(bullet, defender)) {
        game_over = --lives == 0
        blows_taken.push(bullet)
      }
    }
    invader_bullets = invader_bullets.filter(
      (bullet) => !blows_taken.includes(bullet)
    )
  }

  offscreen_bullets: {
    invader_bullets = invader_bullets.filter(({ y }) => y < h)
    defender_bullets = defender_bullets.filter(({ y }) => y > 0)
  }

  const invader_dy = dt * invader_speed
  for (const invader of invaders) {
    invader.y += invader_dy
    game_over = invader.y > h
    if (Math.random() > 0.5 && Date.now() - last_shot > 2000) {
      if (Math.random() > 0.5) continue

      last_shot = Date.now()
      invader_bullets.push({
        x: invader.x + size / 2,
        y: invader.y + size,
      })
    }
  }

  draw(bullets_layer, (ctx) => {
    bullets: {
      invader_bullets.forEach((bullet) => {
        ctx.beginPath()
        ctx.fillStyle = 'red'
        ctx.arc(bullet.x, bullet.y, size / 5, 0, Math.PI)
        ctx.fill()
        ctx.closePath()
      })

      defender_bullets.forEach((bullet) => {
        ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.arc(bullet.x, bullet.y, size / 5, 0, Math.PI, true)
        ctx.fill()
        ctx.closePath()
      })
    }
  })

  draw(mega_layer, (ctx) => {
    barriers: {
      ctx.fillStyle = 'brown'
      barriers.forEach(({ x, y, w, h, hits_left }) => {
        if (hits_left > 0) {
          ctx.font = `bold  ${h * 1.25}px pixelon`
          ctx.fillText(String(hits_left).padStart(2, '0'), x + w / 2 - h, y - h / 2)
          ctx.rect(x, y, w, h)
        }
      })
      ctx.fill()
    }

    defender: {
      draw_image(ctx, defender_image).at({
        y: defender.y,
        x: defender.x,
      })
    }

    explosions: {
      explosions.forEach((e) => {
        draw_image(ctx, explosion_image).at(e)
      })
    }

    invaders: {
      invaders.forEach((invader) => {
        draw_image(ctx, invader_image).at({
          y: invader.y,
          x: invader.x,
        })
      })
    }

    stats: {
      ctx.font = '24px pixelon'
      const stats = `           ${Array(lives)
        .fill('❤️')
        .join(' ')
        .padEnd(3, ' 💥')}  SCORE: ${String(score).padStart(
        5,
        '0'
      )}  RECORD: ${String(hiscore).padStart(5, '0')}`

      ctx.fillStyle = '#ccc'
      ctx.fillRect(0, main.height - size, w, size)
      ctx.strokeRect(0, main.height - size, w, size)
      ctx.fillStyle = '#444'
      ctx.fillText(String(stats), 0, main.height - 3)
      ctx.strokeText(String(stats), 0, main.height - 3)
    }
  })

  return !game_over ? requestAnimationFrame(game) : location.reload()
}

requestAnimationFrame(game)

document.getElementById('app')!.append(main)
