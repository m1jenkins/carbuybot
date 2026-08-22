export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type WorkflowStatus =
  | "awaiting_brief"
  | "brief_submitted"
  | "in_review"
  | "searching"
  | "negotiating"
  | "offers_ready"
  | "completed"
  | "cancelled";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          active: boolean;
          created_at: string;
          role: "admin" | "operator";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          role: "admin" | "operator";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          role?: "admin" | "operator";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      brief_drafts: {
        Row: {
          answers: Json;
          created_at: string;
          current_question_id: string | null;
          engagement_id: string;
          updated_at: string;
        };
        Insert: {
          answers?: Json;
          created_at?: string;
          current_question_id?: string | null;
          engagement_id: string;
          updated_at?: string;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          current_question_id?: string | null;
          engagement_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brief_drafts_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: true;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      engagements: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          customer_email: string;
          id: string;
          onboarding_completed_at: string | null;
          payment_status: PaymentStatus;
          price_id: string;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
          user_id: string | null;
          workflow_status: WorkflowStatus;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          customer_email: string;
          id?: string;
          onboarding_completed_at?: string | null;
          payment_status?: PaymentStatus;
          price_id: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          workflow_status?: WorkflowStatus;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          customer_email?: string;
          id?: string;
          onboarding_completed_at?: string | null;
          payment_status?: PaymentStatus;
          price_id?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          workflow_status?: WorkflowStatus;
        };
        Relationships: [
          {
            foreignKeyName: "engagements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      status_updates: {
        Row: {
          author_id: string | null;
          created_at: string;
          customer_visible: boolean;
          engagement_id: string;
          id: string;
          note: string;
          status: WorkflowStatus;
          title: string;
        };
        Insert: {
          author_id?: string | null;
          created_at?: string;
          customer_visible?: boolean;
          engagement_id: string;
          id?: string;
          note: string;
          status: WorkflowStatus;
          title: string;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          customer_visible?: boolean;
          engagement_id?: string;
          id?: string;
          note?: string;
          status?: WorkflowStatus;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "status_updates_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "status_updates_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          event_id: string;
          event_type: string;
          processed_at: string;
        };
        Insert: {
          event_id: string;
          event_type: string;
          processed_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      vehicle_briefs: {
        Row: {
          budget_cents: number;
          city: string;
          colors: string[];
          condition: "new" | "used" | "either";
          consent: boolean;
          created_at: string;
          deal_breakers: string[];
          engagement_id: string;
          financing_preference: "cash" | "loan" | "lease" | "undecided";
          has_trade_in: boolean;
          make: string;
          model: string;
          notes: string | null;
          options: string[];
          postal_code: string;
          search_radius_miles: number;
          state: string;
          timeline:
            | "immediately"
            | "within_30_days"
            | "within_60_days"
            | "within_90_days"
            | "flexible";
          trade_in_details: string | null;
          trim: string | null;
          updated_at: string;
          year_max: number | null;
          year_min: number | null;
        };
        Insert: {
          budget_cents: number;
          city: string;
          colors?: string[];
          condition: "new" | "used" | "either";
          consent: true;
          created_at?: string;
          deal_breakers?: string[];
          engagement_id: string;
          financing_preference: "cash" | "loan" | "lease" | "undecided";
          has_trade_in: boolean;
          make: string;
          model: string;
          notes?: string | null;
          options?: string[];
          postal_code: string;
          search_radius_miles: number;
          state: string;
          timeline:
            | "immediately"
            | "within_30_days"
            | "within_60_days"
            | "within_90_days"
            | "flexible";
          trade_in_details?: string | null;
          trim?: string | null;
          updated_at?: string;
          year_max?: number | null;
          year_min?: number | null;
        };
        Update: {
          budget_cents?: number;
          city?: string;
          colors?: string[];
          condition?: "new" | "used" | "either";
          consent?: true;
          created_at?: string;
          deal_breakers?: string[];
          engagement_id?: string;
          financing_preference?: "cash" | "loan" | "lease" | "undecided";
          has_trade_in?: boolean;
          make?: string;
          model?: string;
          notes?: string | null;
          options?: string[];
          postal_code?: string;
          search_radius_miles?: number;
          state?: string;
          timeline?:
            | "immediately"
            | "within_30_days"
            | "within_60_days"
            | "within_90_days"
            | "flexible";
          trade_in_details?: string | null;
          trim?: string | null;
          updated_at?: string;
          year_max?: number | null;
          year_min?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_briefs_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: true;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      claim_paid_engagements: {
        Args: {
          p_user_id: string;
          p_verified_email: string;
        };
        Returns: number;
      };
      fulfill_stripe_event: {
        Args: {
          p_amount_cents: number | null;
          p_checkout_session_id: string | null;
          p_currency: string | null;
          p_customer_email: string | null;
          p_customer_id: string | null;
          p_engagement_id: string | null;
          p_event_id: string;
          p_event_type: string;
          p_fulfill: boolean;
          p_payment_intent_id: string | null;
          p_price_id: string | null;
        };
        Returns: boolean;
      };
      finalize_vehicle_brief: {
        Args: {
          p_engagement_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      save_brief_answer: {
        Args: {
          p_current_question_id: string | null;
          p_engagement_id: string;
          p_question_id: string;
          p_value: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Insert"];

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Update"];
