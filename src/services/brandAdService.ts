import { supabase } from '../lib/supabase'
import type { BrandAd } from '../components/SponsoredBanner'

export async function getActiveBrandAds(): Promise<BrandAd[]> {
  try {
    const { data, error } = await supabase
      .from('brand_ads')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

export async function getAllBrandAds(): Promise<BrandAd[]> {
  try {
    const { data } = await supabase
      .from('brand_ads')
      .select('*')
      .order('position', { ascending: true })
    return data ?? []
  } catch {
    return []
  }
}

export async function saveBrandAd(ad: Partial<BrandAd>): Promise<BrandAd | null> {
  try {
    if (ad.id) {
      const { data } = await supabase
        .from('brand_ads')
        .update({ ...ad, updated_at: new Date().toISOString() })
        .eq('id', ad.id)
        .select().single()
      return data
    } else {
      const { data } = await supabase
        .from('brand_ads')
        .insert([{ ...ad, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
        .select().single()
      return data
    }
  } catch {
    return null
  }
}

export async function deleteBrandAd(id: string): Promise<void> {
  await supabase.from('brand_ads').delete().eq('id', id)
}

export async function toggleBrandAd(id: string, isActive: boolean): Promise<void> {
  await supabase.from('brand_ads').update({ is_active: isActive }).eq('id', id)
}
