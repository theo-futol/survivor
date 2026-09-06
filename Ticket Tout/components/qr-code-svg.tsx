"use client"

import { useMemo } from "react"

type QrCodeSvgProps = {
  value: string
  size?: number
  className?: string
  title?: string
}

const VERSION = 3
const QR_SIZE = VERSION * 4 + 17
const DATA_CODEWORDS = 55
const ECC_CODEWORDS = 15

function gfMultiply(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    if (((y >>> i) & 1) !== 0) z ^= x
  }
  return z
}

function reedSolomonDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j]!, root)
      if (j + 1 < degree) result[j] ^= result[j + 1]!
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = new Array<number>(divisor.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ result[0]!
    result.shift()
    result.push(0)
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i]!, factor)
    }
  }
  return result
}

function appendBits(target: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) target.push((value >>> i) & 1)
}

function encodeData(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value))
  if (bytes.length > 53) throw new Error("QR payload too long")

  const bits: number[] = []
  appendBits(bits, 0b0100, 4)
  appendBits(bits, bytes.length, 8)
  bytes.forEach((byte) => appendBits(bits, byte, 8))

  const capacityBits = DATA_CODEWORDS * 8
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!
    data.push(byte)
  }

  const pads = [0xec, 0x11]
  let padIndex = 0
  while (data.length < DATA_CODEWORDS) {
    data.push(pads[padIndex % 2]!)
    padIndex++
  }

  const ecc = reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS))
  return [...data, ...ecc]
}

function formatBits(mask: number) {
  const data = (0b01 << 3) | mask // Error correction level L.
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

function makeMatrix(value: string) {
  const modules = Array.from({ length: QR_SIZE }, () => new Array<boolean>(QR_SIZE).fill(false))
  const functionModules = Array.from({ length: QR_SIZE }, () => new Array<boolean>(QR_SIZE).fill(false))

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return
    modules[y]![x] = dark
    functionModules[y]![x] = true
  }

  const drawFinder = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4)
      }
    }
  }

  drawFinder(3, 3)
  drawFinder(QR_SIZE - 4, 3)
  drawFinder(3, QR_SIZE - 4)

  for (let i = 0; i < QR_SIZE; i++) {
    if (!functionModules[6]![i]) setFunction(i, 6, i % 2 === 0)
    if (!functionModules[i]![6]) setFunction(6, i, i % 2 === 0)
  }

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunction(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }

  const fmt = formatBits(0)
  const bit = (index: number) => ((fmt >>> index) & 1) !== 0

  for (let i = 0; i <= 5; i++) setFunction(8, i, bit(i))
  setFunction(8, 7, bit(6))
  setFunction(8, 8, bit(7))
  setFunction(7, 8, bit(8))
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(i))

  for (let i = 0; i < 8; i++) setFunction(QR_SIZE - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) setFunction(8, QR_SIZE - 15 + i, bit(i))
  setFunction(8, QR_SIZE - 8, true)

  const codewords = encodeData(value)
  const dataBits: boolean[] = []
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) dataBits.push(((byte >>> i) & 1) !== 0)
  }

  let bitIndex = 0
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right--
    const upward = ((right + 1) & 2) === 0
    for (let vert = 0; vert < QR_SIZE; vert++) {
      const y = upward ? QR_SIZE - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const x = right - j
        if (functionModules[y]![x]) continue
        let dark = bitIndex < dataBits.length ? dataBits[bitIndex]! : false
        bitIndex++
        if ((x + y) % 2 === 0) dark = !dark // Mask pattern 0.
        modules[y]![x] = dark
      }
    }
  }

  return modules
}

export function QrCodeSvg({ value, size = 200, className, title = "QR code de paiement" }: QrCodeSvgProps) {
  const matrix = useMemo(() => makeMatrix(value), [value])
  const quietZone = 4
  const viewSize = QR_SIZE + quietZone * 2

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      <rect width={viewSize} height={viewSize} fill="white" />
      {matrix.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" fill="black" /> : null
        )
      )}
    </svg>
  )
}
