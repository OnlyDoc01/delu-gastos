import sharp from 'sharp'
const svg = 'public/icons/favicon.svg'
const full = Buffer.from((await import('fs')).readFileSync(svg, 'utf8').replace('rx="112"', 'rx="0"'))
await sharp(full).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
await sharp(full).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(full).resize(512, 512).png().toFile('public/icons/icon-512.png')
