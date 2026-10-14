export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      booking_items: {
        Row: {
          actual_price: number | null;
          booking_id: string;
          created_at: string;
          duration_min: number;
          id: string;
          owner_id: string;
          pet_id: string;
          planned_price: number;
          position: number;
          service_id: string;
          updated_at: string;
          visit_notes: string;
        };
        Insert: {
          actual_price?: number | null;
          booking_id: string;
          created_at?: string;
          duration_min: number;
          id?: string;
          owner_id?: string;
          pet_id: string;
          planned_price: number;
          position?: number;
          service_id: string;
          updated_at?: string;
          visit_notes?: string;
        };
        Update: {
          actual_price?: number | null;
          booking_id?: string;
          created_at?: string;
          duration_min?: number;
          id?: string;
          owner_id?: string;
          pet_id?: string;
          planned_price?: number;
          position?: number;
          service_id?: string;
          updated_at?: string;
          visit_notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_items_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_items_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          block_reason: string;
          cancelled_at: string | null;
          client_id: string | null;
          completed_at: string | null;
          created_at: string;
          during: unknown;
          end_at: string;
          groomer_id: string;
          id: string;
          kind: Database["public"]["Enums"]["booking_kind"];
          notes: string;
          owner_id: string;
          start_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
        };
        Insert: {
          block_reason?: string;
          cancelled_at?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          during?: unknown;
          end_at: string;
          groomer_id: string;
          id?: string;
          kind?: Database["public"]["Enums"]["booking_kind"];
          notes?: string;
          owner_id?: string;
          start_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Update: {
          block_reason?: string;
          cancelled_at?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          during?: unknown;
          end_at?: string;
          groomer_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["booking_kind"];
          notes?: string;
          owner_id?: string;
          start_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_groomer_id_fkey";
            columns: ["groomer_id"];
            isOneToOne: false;
            referencedRelation: "groomers";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          anonymized_at: string | null;
          archived_at: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          notes: string;
          owner_id: string;
          phone_e164: string | null;
          updated_at: string;
        };
        Insert: {
          anonymized_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          notes?: string;
          owner_id?: string;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Update: {
          anonymized_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          notes?: string;
          owner_id?: string;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      groomers: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          owner_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          owner_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          owner_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          archived_at: string | null;
          birth_date: string | null;
          breed: string;
          client_id: string;
          created_at: string;
          id: string;
          name: string;
          notes: string;
          owner_id: string;
          size: Database["public"]["Enums"]["pet_size"] | null;
          species: Database["public"]["Enums"]["pet_species"];
          updated_at: string;
          weight_kg: number | null;
        };
        Insert: {
          archived_at?: string | null;
          birth_date?: string | null;
          breed?: string;
          client_id: string;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string;
          owner_id?: string;
          size?: Database["public"]["Enums"]["pet_size"] | null;
          species: Database["public"]["Enums"]["pet_species"];
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          archived_at?: string | null;
          birth_date?: string | null;
          breed?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string;
          owner_id?: string;
          size?: Database["public"]["Enums"]["pet_size"] | null;
          species?: Database["public"]["Enums"]["pet_species"];
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "pets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          archived_at: string | null;
          created_at: string;
          default_duration_min: number;
          default_price: number;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          default_duration_min: number;
          default_price: number;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          default_duration_min?: number;
          default_price?: number;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      anonymize_client: { Args: { p_client_id: string }; Returns: undefined };
      create_booking_with_items: {
        Args: {
          p_client_id?: string;
          p_end_at: string;
          p_groomer_id: string;
          p_items: Json;
          p_new_client?: Json;
          p_notes?: string;
          p_start_at: string;
        };
        Returns: string;
      };
      f_search_norm: { Args: { value: string }; Returns: string };
      f_unaccent: { Args: { value: string }; Returns: string };
      get_price_prefill: {
        Args: { p_pet_id: string; p_service_id: string };
        Returns: number;
      };
      search_directory: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          client_id: string;
          id: string;
          kind: string;
          subtitle: string;
          title: string;
        }[];
      };
    };
    Enums: {
      booking_kind: "booking" | "block";
      booking_status: "scheduled" | "completed" | "cancelled" | "no_show";
      pet_size: "xs" | "s" | "m" | "l" | "xl";
      pet_species: "dog" | "cat";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends {
  Row: infer R;
}
  ? R
  : never;

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends {
  Insert: infer I;
}
  ? I
  : never;

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends {
  Update: infer U;
}
  ? U
  : never;

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      booking_kind: ["booking", "block"],
      booking_status: ["scheduled", "completed", "cancelled", "no_show"],
      pet_size: ["xs", "s", "m", "l", "xl"],
      pet_species: ["dog", "cat"],
    },
  },
} as const;
