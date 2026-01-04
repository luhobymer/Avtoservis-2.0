import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const url = Constants?.expoConfig?.extra?.SUPABASE_URL || Constants?.manifest?.extra?.SUPABASE_URL
const key = Constants?.expoConfig?.extra?.SUPABASE_ANON_KEY || Constants?.manifest?.extra?.SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

