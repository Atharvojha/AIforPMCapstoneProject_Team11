// Tool backends. Every tool is a Postgres function tool_<name>(args jsonb) returning jsonb.
// Edge Functions call them by RPC; tests call them over SQL. Same names, same arguments.
export interface Tools { call<T = any>(name: string, args?: Record<string, unknown>): Promise<T>; }

export class SqlTools implements Tools {
  constructor(private q: (sql: string, params: unknown[]) => Promise<{ rows: any[] }>) {}
  async call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const r = await this.q(`select tool_${name}($1::jsonb) as r`, [JSON.stringify(args)]);
    return r.rows[0].r as T;
  }
}

export class RpcTools implements Tools {
  constructor(private supabase: { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: any; error: any }> }) {}
  async call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.supabase.rpc(`tool_${name}`, { args });
    if (error) throw new Error(`tool_${name}: ${error.message ?? error}`);
    return data as T;
  }
}
