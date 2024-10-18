import './style.css'
import './pixelon.otf'
import type { box, position } from './types'
import {
  w,
  h,
  size,
  throttle,
  draw_image,
  point_in_box,
  create_canvas,
  invader_image,
  defender_image,
  explosion_image,
} from './utils'

const { main, draw, stack, layer } = create_canvas(w, h + size)

const mega_layer = layer()
const bullets_layer = layer()

stack([mega_layer, bullets_layer])

let lives = 3
let score = 0
const hiscore_key = 'hiscore'
let hiscore = +(localStorage.getItem(hiscore_key) || 0)

let explosions: Array<position> = []
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

const defender: Pick<position, 'x'> & { readonly y: number } & box = {
  x: w / 2 - size / 2,
  y: h - size,
  w: size,
  h: size / 2,
}

let last_pan_time = 0
const avg_press_duration = 120 // based on avg defaults & xset q | grep "repeat delay"
const base_pan_velocity = w / (4.5 * 1000)
let pan_velocity = base_pan_velocity
const pan_acceleration = (1.03 * base_pan_velocity) / (avg_press_duration * 2)

function pan(e: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight'].includes(e.code)) {
    let dt = avg_press_duration
    if (e.repeat) {
      const now = Date.now()
      dt = last_pan_time != 0 ? now - last_pan_time : dt
      last_pan_time = now
      pan_velocity += pan_acceleration * dt
    } else {
      last_pan_time = 0
      pan_velocity = base_pan_velocity
    }
    const dx = pan_velocity * dt
    defender.x += e.code == 'ArrowLeft' ? -dx : e.key == 'ArrowRight' ? dx : 0
    defender.x =
      defender.x < 0
        ? 0
        : defender.x > w - defender.w
        ? w - defender.w
        : defender.x
  }
}
document.addEventListener('keydown', pan)

function shoot(e: KeyboardEvent) {
  if (e.code == 'Space') {
    defender_bullets.push({
      y: defender.y,
      x: defender.x + size / 2,
    })
  }
}
document.addEventListener('keydown', throttle(shoot, 250))

let invaders: Array<position & box> = []
const per_row = 12
const invader_gap = size * 0.4
for (let r = 0, y = 0; r < 3; r++, y += invader_gap + size) {
  for (
    let c = 0, x = w / 2 - (per_row * size + invader_gap * (per_row - 1)) / 2;
    c < per_row;
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

let last_shot = Date.now()
let previous_time = Date.now()

let bullet_speed = h / (10 * 1000)
let invader_speed = h / (75 * 1000)

function game_loop() {
  const now = Date.now()
  const dt = now - previous_time
  previous_time = now

  const bullet_dy = dt * bullet_speed

  // TODO bullet comes out at full speed, gradually slowing down just before exiting screen
  for (const bullet of invader_bullets) bullet.y += bullet_dy
  for (const bullet of defender_bullets) bullet.y -= bullet_dy

  collisions: {
    const blocked_by_barrier: position[] = []
    for (const barrier of barriers) {
      if (barrier.hits_left > 0) {
        for (const bullet of invader_bullets) {
          if (!point_in_box(bullet, barrier)) continue
          barrier.hits_left--
          blocked_by_barrier.push(bullet)
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
        if (!point_in_box(bullet, invader)) continue

        hiscore = Math.max((score += 10), hiscore)
        localStorage.setItem(hiscore_key, String(hiscore))

        shots_landed.push(bullet)
        destroyed_invaders.push(invader)

        const explosion = { y: invader.y, x: invader.x }
        setTimeout(
          () => (explosions = explosions.filter((e) => e != explosion)),
          2500
        )
        explosions.push(explosion)
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
      if (!point_in_box(bullet, defender)) continue
      game_over = --lives == 0
      blows_taken.push(bullet)
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
    if (
      Math.random() > 0.5 &&
      Date.now() - last_shot > Math.random() * 3000 + 2000
    ) {
      if (Math.random() > 0.5) continue
      last_shot = Date.now()
      invader_bullets.push({
        x: invader.x + size / 2,
        y: invader.y + size / 2,
      })
    }
  }

  draw(bullets_layer, (ctx) => {
    for (const bullet of invader_bullets) {
      ctx.beginPath()
      ctx.fillStyle = 'red'
      ctx.arc(bullet.x, bullet.y, size / 5, 0, Math.PI)
      ctx.fill()
      ctx.closePath()
    }
    for (const bullet of defender_bullets) {
      ctx.beginPath()
      ctx.fillStyle = 'blue'
      ctx.arc(bullet.x, bullet.y, size / 5, 0, Math.PI, true)
      ctx.fill()
      ctx.closePath()
    }
  })

  draw(mega_layer, (ctx) => {
    ctx.fillStyle = 'brown'
    for (const { x, y, w, h, hits_left } of barriers) {
      if (hits_left <= 0) continue
      ctx.rect(x, y, w, h)
      ctx.font = `bold  ${h * 1.25}px pixelon`
      ctx.fillText(String(hits_left).padStart(2, '0'), x + w / 2 - h, y - h / 2)
    }
    ctx.fill()

    for (const explosion of explosions) {
      draw_image(ctx, explosion_image).at(explosion)
    }

    for (const invader of invaders) {
      draw_image(ctx, invader_image).at({
        y: invader.y,
        x: invader.x,
      })
    }

    draw_image(ctx, defender_image).at({
      y: defender.y,
      x: defender.x,
    })

    ctx.font = '24px pixelon'
    const stats = `           ${Array(lives)
      .fill('❤️')
      .join(' ')
      .padEnd(3, '💥')}  SCORE: ${String(score).padStart(
      5,
      '0'
    )}  RECORD: ${String(hiscore).padStart(5, '0')}`

    ctx.fillStyle = '#ccc'
    ctx.fillRect(0, main.height - size, w, size)
    ctx.strokeRect(0, main.height - size, w, size)
    ctx.fillStyle = '#444'
    ctx.fillText(String(stats), 0, main.height - 3)
    ctx.strokeText(String(stats), 0, main.height - 3)
  })

  return !game_over ? requestAnimationFrame(game_loop) : location.reload()
}

requestAnimationFrame(game_loop)

document.getElementById('app')!.append(main)
