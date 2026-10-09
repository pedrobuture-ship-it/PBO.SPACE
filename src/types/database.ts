// Generated from the migrated PostgreSQL catalog. Run npm run db:types after SQL changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type AdminUser = { id: string; display_name: string; username: string | null; avatar_url: string | null; email: string | null; app_role: 'superadmin' | 'admin' | 'user'; created_at: string; status: 'active' | 'invited' | 'disabled'; total_count: number }

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          id: string
          workspace_id: string
          board_id: string | null
          task_id: string | null
          user_id: string | null
          action: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          board_id?: string | null
          task_id?: string | null
          user_id?: string | null
          action: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          board_id?: string | null
          task_id?: string | null
          user_id?: string | null
          action?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "activity_logs_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
          { foreignKeyName: "activity_logs_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "activity_logs_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "activity_logs_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      attachments: {
        Row: {
          id: string
          task_id: string
          user_id: string | null
          file_name: string
          file_url: string
          file_type: string
          file_size: number
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id?: string | null
          file_name: string
          file_url: string
          file_type?: string
          file_size: number
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string | null
          file_name?: string
          file_url?: string
          file_type?: string
          file_size?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "attachments_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "attachments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      board_columns: {
        Row: {
          id: string
          board_id: string
          name: string
          position: number
          color: string
          wip_limit: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          position?: number
          color?: string
          wip_limit?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          position?: number
          color?: string
          wip_limit?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "board_columns_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
        ]
      }
      board_members: {
        Row: {
          id: string
          board_id: string
          user_id: string
          role: Database['public']['Enums']['member_role']
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          user_id: string
          role?: Database['public']['Enums']['member_role']
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          user_id?: string
          role?: Database['public']['Enums']['member_role']
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "board_members_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
          { foreignKeyName: "board_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      boards: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          icon: string
          color: string
          created_by: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          icon?: string
          color?: string
          created_by?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          icon?: string
          color?: string
          created_by?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "boards_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "boards_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          content: string
          completed: boolean
          position: number
          assigned_to: string | null
          due_date: string | null
        }
        Insert: {
          id?: string
          checklist_id: string
          content: string
          completed?: boolean
          position?: number
          assigned_to?: string | null
          due_date?: string | null
        }
        Update: {
          id?: string
          checklist_id?: string
          content?: string
          completed?: boolean
          position?: number
          assigned_to?: string | null
          due_date?: string | null
        }
        Relationships: [
          { foreignKeyName: "checklist_items_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "checklist_items_checklist_id_fkey"; columns: ["checklist_id"]; isOneToOne: false; referencedRelation: "checklists"; referencedColumns: ["id"] },
        ]
      }
      checklists: {
        Row: {
          id: string
          task_id: string
          title: string
          position: number
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          position?: number
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          position?: number
        }
        Relationships: [
          { foreignKeyName: "checklists_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "comment_mentions_comment_id_fkey"; columns: ["comment_id"]; isOneToOne: false; referencedRelation: "comments"; referencedColumns: ["id"] },
          { foreignKeyName: "comment_mentions_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      comments: {
        Row: {
          id: string
          task_id: string
          user_id: string | null
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id?: string | null
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string | null
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "comments_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "comments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          board_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          board_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          board_id?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "favorites_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
          { foreignKeyName: "favorites_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      labels: {
        Row: {
          id: string
          board_id: string
          name: string
          color: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          color?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          color?: string
        }
        Relationships: [
          { foreignKeyName: "labels_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          board_id: string | null
          task_id: string | null
          actor_id: string | null
          content: string
          read: boolean
          created_at: string
          workspace_id: string | null
          dedupe_key: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          board_id?: string | null
          task_id?: string | null
          actor_id?: string | null
          content: string
          read?: boolean
          created_at?: string
          workspace_id?: string | null
          dedupe_key?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          board_id?: string | null
          task_id?: string | null
          actor_id?: string | null
          content?: string
          read?: boolean
          created_at?: string
          workspace_id?: string | null
          dedupe_key?: string | null
        }
        Relationships: [
          { foreignKeyName: "notifications_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          username: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          app_role: Database['public']['Enums']['app_role']
          disabled_at: string | null
        }
        Insert: {
          id: string
          display_name?: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          app_role?: Database['public']['Enums']['app_role']
          disabled_at?: string | null
        }
        Update: {
          id?: string
          display_name?: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          app_role?: Database['public']['Enums']['app_role']
          disabled_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "profiles_id_fkey"; columns: ["id"]; isOneToOne: true; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      task_assignees: {
        Row: {
          task_id: string
          user_id: string
        }
        Insert: {
          task_id: string
          user_id: string
        }
        Update: {
          task_id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "task_assignees_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "task_assignees_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      task_dependencies: {
        Row: {
          id: string
          task_id: string
          depends_on_task_id: string
        }
        Insert: {
          id?: string
          task_id: string
          depends_on_task_id: string
        }
        Update: {
          id?: string
          task_id?: string
          depends_on_task_id?: string
        }
        Relationships: [
          { foreignKeyName: "task_dependencies_depends_on_task_id_fkey"; columns: ["depends_on_task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "task_dependencies_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
        ]
      }
      task_labels: {
        Row: {
          task_id: string
          label_id: string
        }
        Insert: {
          task_id: string
          label_id: string
        }
        Update: {
          task_id?: string
          label_id?: string
        }
        Relationships: [
          { foreignKeyName: "task_labels_label_id_fkey"; columns: ["label_id"]; isOneToOne: false; referencedRelation: "labels"; referencedColumns: ["id"] },
          { foreignKeyName: "task_labels_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
        ]
      }
      task_status_history: {
        Row: {
          id: string
          task_id: string
          board_id: string
          column_id: string
          entered_at: string
          exited_at: string | null
          is_baseline: boolean
        }
        Insert: {
          id?: string
          task_id: string
          board_id: string
          column_id: string
          entered_at: string
          exited_at?: string | null
          is_baseline?: boolean
        }
        Update: {
          id?: string
          task_id?: string
          board_id?: string
          column_id?: string
          entered_at?: string
          exited_at?: string | null
          is_baseline?: boolean
        }
        Relationships: [
          { foreignKeyName: "task_status_history_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
          { foreignKeyName: "task_status_history_column_id_fkey"; columns: ["column_id"]; isOneToOne: false; referencedRelation: "board_columns"; referencedColumns: ["id"] },
          { foreignKeyName: "task_status_history_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
        ]
      }
      task_subtasks: {
        Row: {
          parent_task_id: string
          child_task_id: string
          position: number
          created_at: string
        }
        Insert: {
          parent_task_id: string
          child_task_id: string
          position?: number
          created_at?: string
        }
        Update: {
          parent_task_id?: string
          child_task_id?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "task_subtasks_child_task_id_fkey"; columns: ["child_task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "task_subtasks_parent_task_id_fkey"; columns: ["parent_task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
        ]
      }
      tasks: {
        Row: {
          id: string
          board_id: string
          column_id: string
          title: string
          description: string | null
          priority: Database['public']['Enums']['task_priority']
          position: number
          due_date: string | null
          start_date: string | null
          estimated_minutes: number | null
          archived: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          board_id: string
          column_id: string
          title: string
          description?: string | null
          priority?: Database['public']['Enums']['task_priority']
          position?: number
          due_date?: string | null
          start_date?: string | null
          estimated_minutes?: number | null
          archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          board_id?: string
          column_id?: string
          title?: string
          description?: string | null
          priority?: Database['public']['Enums']['task_priority']
          position?: number
          due_date?: string | null
          start_date?: string | null
          estimated_minutes?: number | null
          archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "tasks_board_id_fkey"; columns: ["board_id"]; isOneToOne: false; referencedRelation: "boards"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_column_id_board_id_fkey"; columns: ["column_id","board_id"]; isOneToOne: false; referencedRelation: "board_columns"; referencedColumns: ["id","board_id"] },
          { foreignKeyName: "tasks_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      workspace_invitations: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: Database['public']['Enums']['member_role']
          token: string
          invited_by: string | null
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role: Database['public']['Enums']['member_role']
          token: string
          invited_by?: string | null
          expires_at: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: Database['public']['Enums']['member_role']
          token?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "workspace_invitations_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "workspace_invitations_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: Database['public']['Enums']['member_role']
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: Database['public']['Enums']['member_role']
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: Database['public']['Enums']['member_role']
          joined_at?: string
        }
        Relationships: [
          { foreignKeyName: "workspace_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "workspace_members_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      workspaces: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
          logo_url: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
          logo_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
          logo_url?: string | null
        }
        Relationships: [
          { foreignKeyName: "workspaces_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      accept_workspace_invitation: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      admin_list_users: {
        Args: {
          p_search?: string
          p_role?: Database['public']['Enums']['app_role'] | null
          p_status?: string | null
          p_limit?: number
          p_offset?: number
        }
        Returns: AdminUser[]
      }
      admin_set_user_status: {
        Args: {
          p_user_id: string
          p_disabled: boolean
        }
        Returns: string
      }
      board_member_directory: {
        Args: {
          p_board_id: string
        }
        Returns: Json
      }
      board_task_badges: {
        Args: {
          p_board_id: string
        }
        Returns: Json
      }
      create_column: {
        Args: {
          p_board_id: string
          p_name: string
          p_color?: string
          p_wip_limit?: number
        }
        Returns: Database['public']['Tables']['board_columns']['Row'][]
      }
      create_comment_with_mentions: {
        Args: {
          p_task_id: string
          p_content: string
          p_mentions?: Json
        }
        Returns: Database['public']['Tables']['comments']['Row']
      }
      create_subtask: {
        Args: {
          p_parent_task_id: string
          p_title: string
        }
        Returns: Database['public']['Tables']['tasks']['Row']
      }
      create_task: {
        Args: {
          p_board_id: string
          p_column_id: string
          p_title: string
          p_priority?: Database['public']['Enums']['task_priority'] | null
        }
        Returns: Database['public']['Tables']['tasks']['Row'][]
      }
      create_workspace_invitation: {
        Args: {
          p_workspace_id: string
          p_email: string
          p_role: Database['public']['Enums']['member_role']
        }
        Returns: Json
      }
      dashboard_analytics: {
        Args: {
          p_workspace_id: string
          p_board_id?: string | null
          p_from?: string
          p_to?: string
          p_assignee_id?: string | null
          p_priority?: Database['public']['Enums']['task_priority'] | null
        }
        Returns: Json
      }
      home_boards: {
        Args: {
          p_workspace_id: string
        }
        Returns: Json
      }
      home_metrics: {
        Args: {
          p_workspace_id: string
        }
        Returns: Json
      }
      home_overview: {
        Args: {
          p_workspace_id: string
        }
        Returns: Json
      }
      lookup_workspace_invitation: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      move_column: {
        Args: {
          p_column_id: string
          p_before_id?: string | null
          p_after_id?: string | null
        }
        Returns: Database['public']['Tables']['board_columns']['Row'][]
      }
      move_task: {
        Args: {
          p_task_id: string
          p_column_id: string
          p_before_id?: string | null
          p_after_id?: string | null
        }
        Returns: Database['public']['Tables']['tasks']['Row'][]
      }
      revoke_workspace_invitation: {
        Args: {
          p_invitation_id: string
        }
        Returns: undefined
      }
      transfer_board_ownership: {
        Args: {
          p_board_id: string
          p_new_owner_id: string
        }
        Returns: undefined
      }
      transfer_workspace_ownership: {
        Args: {
          p_workspace_id: string
          p_new_owner_id: string
        }
        Returns: undefined
      }
      update_comment_with_mentions: {
        Args: {
          p_comment_id: string
          p_content: string
          p_mentions?: Json
        }
        Returns: Database['public']['Tables']['comments']['Row']
      }
      workspace_member_directory: {
        Args: {
          p_workspace_id: string
        }
        Returns: Json
      }
      workspace_update_member: {
        Args: {
          p_workspace_id: string
          p_member_user_id: string
          p_display_name?: string
          p_workspace_role?: Database['public']['Enums']['member_role']
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user"
      member_role: "owner" | "admin" | "member" | "viewer"
      task_priority: "none" | "low" | "medium" | "high" | "urgent"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type TableName = keyof Database['public']['Tables']
export type Tables<T extends TableName> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends TableName> = Database['public']['Tables'][T]['Update']
