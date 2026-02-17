import { nanoid } from "nanoid";
import type { AgentTask, AgentResult } from "@volleycoach/shared";

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  version: string;
}

export abstract class BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string = "1.0.0";

  constructor(name: string, description: string) {
    this.id = `agent_${nanoid(12)}`;
    this.name = name;
    this.description = description;
  }

  abstract getCapabilities(): AgentCapability[];

  abstract processTask(task: AgentTask): Promise<AgentResult>;

  getCard(): AgentCard {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      capabilities: this.getCapabilities(),
      version: this.version,
    };
  }

  protected createResult(
    taskId: string,
    status: AgentResult["status"],
    data: unknown,
    confidence: number,
    startTime: number
  ): AgentResult {
    return {
      agentId: this.id,
      taskId,
      status,
      data,
      confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  protected log(message: string, data?: unknown) {
    const prefix = `[${this.name}]`;
    if (data) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, message);
    }
  }

  protected logError(message: string, error: unknown) {
    console.error(`[${this.name}] ERROR:`, message, error);
  }
}
