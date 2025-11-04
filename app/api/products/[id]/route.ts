import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: any }) {
  try {
    // params may be a Promise in some Next.js runtimes — resolve if needed
    const resolved = typeof params?.then === 'function' ? await params : params
    const id = Number(resolved.id)
    if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const product = await prisma.product.findUnique({
      where: { id },
      include: { owner: true, comments: { include: { author: true } } },
    })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ product })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
