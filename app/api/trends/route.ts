import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

function formatDate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization')?.replace('Bearer ', '')
    const user = await getUserFromToken(auth || undefined)
    if (!user || user.role !== 'seller') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // time windows
    const today = new Date()
    const days = 30
    const startDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000)

    // fetch seller's products and comments in last 30 days
    const products = await prisma.product.findMany({
      where: { ownerId: user.id },
      include: { comments: { where: { createdAt: { gte: startDate } } }, owner: true },
    })

    const productIds = products.map((p) => p.id)

    // build a date buckets array for last `days`
    const dateBuckets: string[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      dateBuckets.push(formatDate(d))
    }

    // per-product timeseries and aggregates
    const productSeries = products.map((p) => {
      const countsByDate: Record<string, number> = {}
      dateBuckets.forEach((d) => (countsByDate[d] = 0))
      p.comments.forEach((c: any) => {
        const key = formatDate(new Date(c.createdAt))
        if (countsByDate[key] !== undefined) countsByDate[key]++
      })
      const timeseries = dateBuckets.map((d) => ({ date: d, count: countsByDate[d] || 0 }))
      const total30 = timeseries.reduce((s, t) => s + t.count, 0)
      const last7 = timeseries.slice(-7).reduce((s, t) => s + t.count, 0)
      const prev7 = timeseries.slice(-14, -7).reduce((s, t) => s + t.count, 0)
      const growth = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0
      return {
        id: p.id,
        name: p.name,
        seller: (p.owner && (p.owner.name || '')) || '',
        timeseries,
        total30,
        last7,
        prev7,
        growthPercent: growth,
      }
    })

    // aggregated overall timeseries across products
    const aggregated = dateBuckets.map((d) => ({ date: d, count: productSeries.reduce((s, p) => s + (p.timeseries.find((t) => t.date === d)?.count || 0), 0) }))

    // compute top trending products (by growthPercent then last7)
    const topTrending = [...productSeries]
      .sort((a, b) => b.growthPercent - a.growthPercent || b.last7 - a.last7)
      .slice(0, 8)

    return NextResponse.json({ aggregated, products: productSeries, topTrending })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to compute trends' }, { status: 500 })
  }
}
