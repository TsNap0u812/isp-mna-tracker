import { useState } from 'react'

const KEY = 'isp-mna-user-deals'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function useLocalDeals() {
  const [localDeals, setLocalDeals] = useState(load)

  const addDeal = (deal) => {
    const entry = { ...deal, id: `user-${Date.now()}`, userAdded: true }
    setLocalDeals(prev => {
      const next = [entry, ...prev]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
    return entry
  }

  const removeDeal = (id) => {
    setLocalDeals(prev => {
      const next = prev.filter(d => d.id !== id)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return { localDeals, addDeal, removeDeal }
}
