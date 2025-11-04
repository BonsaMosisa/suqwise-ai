import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization')?.replace('Bearer ', '')
    const user = await getUserFromToken(auth || undefined)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { productId, text, rating } = await req.json()
    if (!productId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const comment = await prisma.comment.create({ data: { productId: Number(productId), text, rating: Number(rating) || 0, authorId: user.id } })
    return NextResponse.json({ comment })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
