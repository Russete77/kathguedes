export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      affiliate_links: {
        Row: {
          affiliate_url: string
          category: string
          clicks_count: number
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          module: string
          platform: string
          required_plan: string
          sort_order: number
          title: string
        }
        Insert: {
          affiliate_url: string
          category: string
          clicks_count?: number
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          module: string
          platform: string
          required_plan?: string
          sort_order?: number
          title: string
        }
        Update: {
          affiliate_url?: string
          category?: string
          clicks_count?: number
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          module?: string
          platform?: string
          required_plan?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          current_value: number | null
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          current_value?: number | null
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          current_value?: number | null
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          is_active: boolean | null
          reward_text: string | null
          start_date: string
          target_value: number
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          reward_text?: string | null
          start_date: string
          target_value: number
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          reward_text?: string | null
          start_date?: string
          target_value?: number
          title?: string
          type?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          anamnesis: Json | null
          created_at: string
          daily_calories: number | null
          daily_carbs: number | null
          daily_fat: number | null
          daily_protein: number | null
          diet_plan: Json | null
          id: string
          notes_admin: string | null
          package_type: string
          status: string
          user_id: string
          valid_until: string
          workout_plan: Json | null
        }
        Insert: {
          anamnesis?: Json | null
          created_at?: string
          daily_calories?: number | null
          daily_carbs?: number | null
          daily_fat?: number | null
          daily_protein?: number | null
          diet_plan?: Json | null
          id?: string
          notes_admin?: string | null
          package_type: string
          status?: string
          user_id: string
          valid_until: string
          workout_plan?: Json | null
        }
        Update: {
          anamnesis?: Json | null
          created_at?: string
          daily_calories?: number | null
          daily_carbs?: number | null
          daily_fat?: number | null
          daily_protein?: number | null
          diet_plan?: Json | null
          id?: string
          notes_admin?: string | null
          package_type?: string
          status?: string
          user_id?: string
          valid_until?: string
          workout_plan?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          discount_pct: number | null
          id: string
          is_active: boolean
          is_flash: boolean
          max_uses: number | null
          module: string
          partner_name: string
          partner_url: string
          required_plan: string
          title: string
          uses_count: number
          valid_until: string
        }
        Insert: {
          code: string
          discount_pct?: number | null
          id?: string
          is_active?: boolean
          is_flash?: boolean
          max_uses?: number | null
          module: string
          partner_name: string
          partner_url: string
          required_plan?: string
          title: string
          uses_count?: number
          valid_until: string
        }
        Update: {
          code?: string
          discount_pct?: number | null
          id?: string
          is_active?: boolean
          is_flash?: boolean
          max_uses?: number | null
          module?: string
          partner_name?: string
          partner_url?: string
          required_plan?: string
          title?: string
          uses_count?: number
          valid_until?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_role: string
          is_read: boolean
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_role?: string
          is_read?: boolean
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_role?: string
          is_read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moto_events: {
        Row: {
          created_at: string | null
          current_participants: number | null
          description: string | null
          event_date: string
          id: string
          image_url: string | null
          is_active: boolean | null
          location: string | null
          location_url: string | null
          max_participants: number | null
          required_plan: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          current_participants?: number | null
          description?: string | null
          event_date: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location?: string | null
          location_url?: string | null
          max_participants?: number | null
          required_plan?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          current_participants?: number | null
          description?: string | null
          event_date?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location?: string | null
          location_url?: string | null
          max_participants?: number | null
          required_plan?: string | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          icon: string | null
          id: string
          is_read: boolean
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          icon?: string | null
          id?: string
          is_read?: boolean
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_read?: boolean
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          asaas_payment_id: string | null
          cashback_used_cents: number
          created_at: string
          discount_cents: number
          estimated_delivery: string | null
          id: string
          items: Json
          melhor_envio_order_id: string | null
          notes: string | null
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          shipping_cost_cents: number | null
          shipping_info: Json | null
          shipping_label_url: string | null
          shipping_method: string | null
          status: string
          subtotal_cents: number
          total_cents: number
          tracking_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_payment_id?: string | null
          cashback_used_cents?: number
          created_at?: string
          discount_cents?: number
          estimated_delivery?: string | null
          id?: string
          items: Json
          melhor_envio_order_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          shipping_cost_cents?: number | null
          shipping_info?: Json | null
          shipping_label_url?: string | null
          shipping_method?: string | null
          status?: string
          subtotal_cents: number
          total_cents: number
          tracking_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_payment_id?: string | null
          cashback_used_cents?: number
          created_at?: string
          discount_cents?: number
          estimated_delivery?: string | null
          id?: string
          items?: Json
          melhor_envio_order_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          shipping_cost_cents?: number | null
          shipping_info?: Json | null
          shipping_label_url?: string | null
          shipping_method?: string | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      plan_templates: {
        Row: {
          created_at: string
          data: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          compare_price: number | null
          cost_cents: number
          created_at: string
          description: string | null
          height_cm: number | null
          id: string
          image_url: string
          is_active: boolean
          length_cm: number | null
          module: string
          price_cents: number
          sort_order: number
          stock: number
          title: string
          variants: Json
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          category: string
          compare_price?: number | null
          cost_cents?: number
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url: string
          is_active?: boolean
          length_cm?: number | null
          module?: string
          price_cents: number
          sort_order?: number
          stock?: number
          title: string
          variants?: Json
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          category?: string
          compare_price?: number | null
          cost_cents?: number
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string
          is_active?: boolean
          length_cm?: number | null
          module?: string
          price_cents?: number
          sort_order?: number
          stock?: number
          title?: string
          variants?: Json
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          avatar_url: string | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          interests: string[]
          last_workout_at: string | null
          onboarding_completed: boolean
          phone: string | null
          plan_tier: string
          subscription_ends_at: string | null
          subscription_status: string
          workout_streak: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id: string
          interests?: string[]
          last_workout_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          plan_tier?: string
          subscription_ends_at?: string | null
          subscription_status?: string
          workout_streak?: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          interests?: string[]
          last_workout_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          plan_tier?: string
          subscription_ends_at?: string | null
          subscription_status?: string
          workout_streak?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      webhook_events: {
        Row: {
          event: string
          payment_id: string
          processed_at: string | null
        }
        Insert: {
          event: string
          payment_id: string
          processed_at?: string | null
        }
        Update: {
          event?: string
          payment_id?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          completed_at: string
          duration_actual: number | null
          id: string
          user_id: string
          workout_id: string
        }
        Insert: {
          completed_at?: string
          duration_actual?: number | null
          id?: string
          user_id?: string
          workout_id: string
        }
        Update: {
          completed_at?: string
          duration_actual?: number | null
          id?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workout_videos"
            referencedColumns: ["id"]
          }
        ]
      }
      workout_videos: {
        Row: {
          category: string
          description: string | null
          duration_minutes: number
          equipment: string[] | null
          id: string
          is_published: boolean
          is_short: boolean
          level: string
          notes: string | null
          published_at: string | null
          required_plan: string
          thumbnail_url: string | null
          title: string
          views_count: number
          youtube_id: string
        }
        Insert: {
          category: string
          description?: string | null
          duration_minutes: number
          equipment?: string[] | null
          id?: string
          is_published?: boolean
          is_short?: boolean
          level: string
          notes?: string | null
          published_at?: string | null
          required_plan?: string
          thumbnail_url?: string | null
          title: string
          views_count?: number
          youtube_id: string
        }
        Update: {
          category?: string
          description?: string | null
          duration_minutes?: number
          equipment?: string[] | null
          id?: string
          is_published?: boolean
          is_short?: boolean
          level?: string
          notes?: string | null
          published_at?: string | null
          required_plan?: string
          thumbnail_url?: string | null
          title?: string
          views_count?: number
          youtube_id?: string
        }
        Relationships: []
      }
      coupon_uses: {
        Row: {
          coupon_id: string
          id: string
          used_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          used_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      estetica_services: {
        Row: {
          category: string
          compare_price: number | null
          cost_cents: number
          created_at: string
          description: string | null
          duration_min: number
          eligible_for_loyalty: boolean
          id: string
          image_url: string | null
          includes: string[]
          is_active: boolean
          price_cents: number
          requires_paid_plan: boolean
          sort_order: number
          title: string
        }
        Insert: {
          category: string
          compare_price?: number | null
          cost_cents?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          eligible_for_loyalty?: boolean
          id?: string
          image_url?: string | null
          includes?: string[]
          is_active?: boolean
          price_cents: number
          requires_paid_plan?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          category?: string
          compare_price?: number | null
          cost_cents?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          eligible_for_loyalty?: boolean
          id?: string
          image_url?: string | null
          includes?: string[]
          is_active?: boolean
          price_cents?: number
          requires_paid_plan?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      estetica_schedule: {
        Row: {
          closes_at: string | null
          day_of_week: number
          is_closed: boolean
          opens_at: string | null
          slot_minutes: number
        }
        Insert: {
          closes_at?: string | null
          day_of_week: number
          is_closed?: boolean
          opens_at?: string | null
          slot_minutes?: number
        }
        Update: {
          closes_at?: string | null
          day_of_week?: number
          is_closed?: boolean
          opens_at?: string | null
          slot_minutes?: number
        }
        Relationships: []
      }
      estetica_slots_blocked: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: []
      }
      estetica_bookings: {
        Row: {
          asaas_payment_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          cashback_used_cents: number
          duration_min: number
          id: string
          loyalty_free: boolean
          notes: string | null
          paid_at: string | null
          plan_discount_cents: number
          price_cents: number
          scheduled_at: string
          service_id: string
          status: string
          total_cents: number
          updated_at: string
          user_id: string
          vehicle_brand: string
          vehicle_color: string | null
          vehicle_model: string
          vehicle_plate: string
        }
        Insert: {
          asaas_payment_id?: string | null
          cashback_used_cents?: number
          created_at?: string
          customer_name: string
          customer_phone: string
          duration_min: number
          id?: string
          loyalty_free?: boolean
          notes?: string | null
          paid_at?: string | null
          plan_discount_cents?: number
          price_cents: number
          scheduled_at: string
          service_id: string
          status?: string
          total_cents: number
          updated_at?: string
          user_id: string
          vehicle_brand: string
          vehicle_color?: string | null
          vehicle_model: string
          vehicle_plate: string
        }
        Update: {
          asaas_payment_id?: string | null
          cashback_used_cents?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string
          duration_min?: number
          id?: string
          loyalty_free?: boolean
          notes?: string | null
          paid_at?: string | null
          plan_discount_cents?: number
          price_cents?: number
          scheduled_at?: string
          service_id?: string
          status?: string
          total_cents?: number
          updated_at?: string
          user_id?: string
          vehicle_brand?: string
          vehicle_color?: string | null
          vehicle_model?: string
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "estetica_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "estetica_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estetica_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      estetica_portfolio: {
        Row: {
          after_url: string
          before_url: string
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          service_id: string | null
          sort_order: number
          title: string | null
        }
        Insert: {
          after_url: string
          before_url: string
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          service_id?: string | null
          sort_order?: number
          title?: string | null
        }
        Update: {
          after_url?: string
          before_url?: string
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          service_id?: string | null
          sort_order?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estetica_portfolio_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "estetica_services"
            referencedColumns: ["id"]
          }
        ]
      }
      estetica_loyalty_photos: {
        Row: {
          approved: boolean
          approved_at: string | null
          booking_id: string
          created_at: string
          id: string
          month: string
          photo_url: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          booking_id: string
          created_at?: string
          id?: string
          month: string
          photo_url: string
          user_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          month?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estetica_loyalty_photos_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "estetica_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estetica_loyalty_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      plans: {
        Row: {
          slug: string
          name: string
          level: number
          price_cents: number
          asaas_value: number
          asaas_description: string
          cashback_pct: number
          store_discount_pct: number
          estetica_discount_pct: number
          features: Json
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          slug: string
          name: string
          level: number
          price_cents: number
          asaas_value: number
          asaas_description: string
          cashback_pct?: number
          store_discount_pct?: number
          estetica_discount_pct?: number
          features?: Json
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          level?: number
          price_cents?: number
          asaas_value?: number
          asaas_description?: string
          cashback_pct?: number
          store_discount_pct?: number
          estetica_discount_pct?: number
          features?: Json
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          clerk_user_id: string | null
          email: string
          full_name: string
          role: string
          pix_key: string | null
          bank_account: Json | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clerk_user_id?: string | null
          email: string
          full_name: string
          role: string
          pix_key?: string | null
          bank_account?: Json | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string | null
          email?: string
          full_name?: string
          role?: string
          pix_key?: string | null
          bank_account?: Json | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          id: string
          team_member_id: string
          applies_to_type: string | null
          applies_to_category: string | null
          pct: number
          applies_from: string
          applies_to: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          team_member_id: string
          applies_to_type?: string | null
          applies_to_category?: string | null
          pct: number
          applies_from?: string
          applies_to?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          team_member_id?: string
          applies_to_type?: string | null
          applies_to_category?: string | null
          pct?: number
          applies_from?: string
          applies_to?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          }
        ]
      }
      commission_allocations: {
        Row: {
          id: string
          revenue_stream_id: string
          team_member_id: string
          pct: number
          amount_cents: number
          status: string
          paid_at: string | null
          payout_reference: string | null
          created_at: string
        }
        Insert: {
          id?: string
          revenue_stream_id: string
          team_member_id: string
          pct: number
          amount_cents: number
          status?: string
          paid_at?: string | null
          payout_reference?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          revenue_stream_id?: string
          team_member_id?: string
          pct?: number
          amount_cents?: number
          status?: string
          paid_at?: string | null
          payout_reference?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_allocations_revenue_stream_id_fkey"
            columns: ["revenue_stream_id"]
            isOneToOne: false
            referencedRelation: "revenue_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_allocations_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          }
        ]
      }
      revenue_streams: {
        Row: {
          id: string
          type: string
          category: string | null
          user_id: string | null
          reference_type: string
          reference_id: string
          asaas_payment_id: string | null
          gross_cents: number
          cost_cents: number
          net_cents: number
          cashback_used_cents: number
          status: string
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          category?: string | null
          user_id?: string | null
          reference_type: string
          reference_id: string
          asaas_payment_id?: string | null
          gross_cents: number
          cost_cents?: number
          cashback_used_cents?: number
          status?: string
          occurred_at: string
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          category?: string | null
          user_id?: string | null
          reference_type?: string
          reference_id?: string
          asaas_payment_id?: string | null
          gross_cents?: number
          cost_cents?: number
          cashback_used_cents?: number
          status?: string
          occurred_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      wallet_credits: {
        Row: {
          id: string
          user_id: string
          source_revenue_stream_id: string | null
          spent_on_revenue_stream_id: string | null
          amount_cents: number
          expires_at: string | null
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_revenue_stream_id?: string | null
          spent_on_revenue_stream_id?: string | null
          amount_cents: number
          expires_at?: string | null
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_revenue_stream_id?: string | null
          spent_on_revenue_stream_id?: string | null
          amount_cents?: number
          expires_at?: string | null
          used_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      wallet_balance: {
        Row: {
          user_id: string
          active_cents: number
          earned_total_cents: number
          spent_total_cents: number
          expired_total_cents: number
          updated_at: string
        }
        Insert: {
          user_id: string
          active_cents?: number
          earned_total_cents?: number
          spent_total_cents?: number
          expired_total_cents?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          active_cents?: number
          earned_total_cents?: number
          spent_total_cents?: number
          expired_total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_balance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      monthly_usage: {
        Row: {
          user_id: string
          year_month: string
          affiliate_clicks_count: number
        }
        Insert: {
          user_id: string
          year_month: string
          affiliate_clicks_count?: number
        }
        Update: {
          user_id?: string
          year_month?: string
          affiliate_clicks_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_loyalty_eligibility: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      compute_cashback_cents: {
        Args: { p_user_id: string; p_amount_paid_cash_cents: number }
        Returns: number
      }
      compute_commissions: {
        Args: { p_revenue_stream_id: string }
        Returns: number
      }
      credit_wallet_cents: {
        Args: {
          p_user_id: string
          p_amount_cents: number
          p_source_stream_id: string
          p_validity_days?: number
        }
        Returns: undefined
      }
      decrement_stock_batch: {
        Args: { p_items: Json }
        Returns: undefined
      }
      expire_wallet_credits: {
        Args: Record<string, never>
        Returns: number
      }
      increment_stock_batch: {
        Args: { p_items: Json }
        Returns: undefined
      }
      spend_wallet_cents: {
        Args: {
          p_user_id: string
          p_amount_cents: number
          p_revenue_stream_id?: string | null
        }
        Returns: number
      }
      wallet_active_cents: {
        Args: { p_user_id: string }
        Returns: number
      }
      decrement_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      get_available_slots: {
        Args: { p_date: string; p_duration_min: number }
        Returns: string[]
      }
      increment_affiliate_clicks: { Args: { link_id: string }; Returns: undefined }
      increment_coupon_uses: { Args: { coupon_id: string }; Returns: undefined }
      increment_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      lazy_cleanup_loyalty_photos: {
        Args: { p_user_id: string }
        Returns: number
      }
      plan_tier_level: { Args: { tier: string }; Returns: number }
      try_increment_affiliate_click: {
        Args: { p_user_id: string; p_year_month: string; p_limit: number | null }
        Returns: { allowed: boolean; new_count: number }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
