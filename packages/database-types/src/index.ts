export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  current_phase: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  sprint_id: string | null;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  position: number;
  due_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      workspaces: Table<WorkspaceRow>;
      workspace_memberships: Table<{
        workspace_id: string;
        user_id: string;
        role: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      profiles: Table<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
        updated_at: string;
      }>;
      projects: Table<ProjectRow>;
      sprints: Table<{
        id: string;
        workspace_id: string;
        project_id: string;
        title: string;
        starts_on: string | null;
        ends_on: string | null;
        status: string;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      tasks: Table<TaskRow>;
      task_steps: Table<{
        id: string;
        workspace_id: string;
        task_id: string;
        position: number;
        title: string;
        is_done: boolean;
        completed_at: string | null;
        completed_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      evidence: Table<{
        id: string;
        workspace_id: string;
        project_id: string;
        task_id: string;
        kind: string;
        title: string;
        content: string | null;
        storage_path: string | null;
        mime_type: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      qr_tokens: Table<{
        id: string;
        workspace_id: string;
        project_id: string;
        task_id: string | null;
        token: string;
        intent: string;
        target_status: string | null;
        requires_confirmation: boolean;
        status: string;
        expires_at: string | null;
        used_at: string | null;
        used_by: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      action_logs: Table<{
        audit_id: string;
        workspace_id: string;
        project_id: string | null;
        task_id: string | null;
        token_id: string | null;
        actor_user_id: string | null;
        action_type: string;
        intent: string | null;
        from_state: Json | null;
        to_state: Json | null;
        idempotency_key: string | null;
        metadata: Json;
        created_at: string;
      }>;
      recycle_submissions: Table<{
        id: string;
        workspace_id: string;
        project_id: string;
        sprint_id: string | null;
        task_id: string | null;
        status: string;
        storage_path: string | null;
        structured_input: Json;
        consent_at: string;
        retention_until: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_project_with_first_task: {
        Args: { p_name: string; p_description: string; p_first_task_title: string; p_steps: string[] };
        Returns: Json;
      };
      get_current_position: {
        Args: { p_project_id: string };
        Returns: Json;
      };
      complete_task_step: {
        Args: { p_task_id: string; p_position: number; p_idempotency_key: string };
        Returns: Json;
      };
      resolve_qr_token: {
        Args: { p_token: string };
        Returns: Array<{
          token: string;
          workspace_id: string;
          project_id: string;
          task_id: string | null;
          task_reference: string | null;
          task_title: string | null;
          current_status: string | null;
          intent: string;
          target_status: string | null;
          requires_confirmation: boolean;
          status: string;
          expires_at: string | null;
        }>;
      };
      confirm_qr_action: {
        Args: { p_token: string; p_idempotency_key: string };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
