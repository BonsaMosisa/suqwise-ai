import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret"

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as any
  } catch (e) {
    return null
  }
}

export async function getUserFromToken(token?: string) {
  if (!token) return null
  const data = verifyToken(token)
  if (!data || typeof data !== "object") return null
  const userId = (data as any).id
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
  return user
}
