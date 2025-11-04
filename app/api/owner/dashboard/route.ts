import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization')?.replace('Bearer ', '')
    const user = await getUserFromToken(auth || undefined)
    if (!user || user.role !== 'seller') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const products = await prisma.product.findMany({ where: { ownerId: user.id }, include: { comments: true } })
    const stats = products.map((p: { id: any; name: any; comments: string | any[] }) => ({ id: p.id, name: p.name, comments: p.comments.length }))
    return NextResponse.json({ products, stats })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}
