import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const where: any = {}
    if (category) where.category = category

  const products = await prisma.product.findMany({ where, include: { comments: true, owner: true } })
    return NextResponse.json({ products })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // require seller auth
    const auth = req.headers.get('authorization')?.replace('Bearer ', '')
    const user = await getUserFromToken(auth || undefined)
    if (!user || user.role !== 'seller') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, about, price, category, image, specs, stock, inStock, deliveryDays } = body
  const numericPrice = Number(price)
  const numericStock = stock !== undefined ? Number(stock) : undefined
  const available = inStock === undefined ? true : Boolean(inStock)
  if (!name || !category || Number.isNaN(numericPrice)) return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })

  // Defensive: truncate description and about to avoid database column length errors (P2000).
  // Recommended permanent fix: change Prisma schema to use `@db.Text` for Product.description and run a migration.
  const MAX_DESCRIPTION_LENGTH = 191
  let safeDescription = description
  if (typeof safeDescription === 'string' && safeDescription.length > MAX_DESCRIPTION_LENGTH) {
    console.warn(`Truncating product description from ${safeDescription.length} to ${MAX_DESCRIPTION_LENGTH} chars to avoid DB errors.`)
    safeDescription = safeDescription.slice(0, MAX_DESCRIPTION_LENGTH - 1) + '…'
  }
  let safeAbout = about
  if (typeof safeAbout === 'string' && safeAbout.length > MAX_DESCRIPTION_LENGTH) {
    console.warn(`Truncating product about from ${safeAbout.length} to ${MAX_DESCRIPTION_LENGTH} chars to avoid DB errors.`)
    safeAbout = safeAbout.slice(0, MAX_DESCRIPTION_LENGTH - 1) + '…'
  }

  const dataToCreate: any = { name, description: safeDescription, about: safeAbout, price: numericPrice, category, image, ownerId: user.id }
  if (specs) dataToCreate.specs = specs
  if (numericStock !== undefined) dataToCreate.stock = numericStock
  if (deliveryDays !== undefined) dataToCreate.deliveryDays = Number(deliveryDays)
  dataToCreate.inStock = available

  const product = await prisma.product.create({ data: dataToCreate })
    return NextResponse.json({ product })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}

