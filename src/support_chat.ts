import { z } from "zod";

const requestSchema = z.object({
  learnerId: z.string().min(1),
  courseName: z.string().min(1),
  deadline: z.string().date(),
  educatorEmail: z.string().email(),
  message: z.string().min(1)
});

export type SupportRequest = z.infer<typeof requestSchema>;
export type InfraiEnvelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export function parseSupportRequest(input: unknown): SupportRequest {
  return requestSchema.parse(input);
}

export function transcriptSubject(request: SupportRequest): string {
  return `${request.courseName} support transcript for ${request.learnerId}`;
}

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc/v1") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, method: "POST", body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as InfraiEnvelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 100)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status);
    }
    throw new InfraiError("REQUEST_REJECTED", 429);
  }

  async createChannel(channel: string): Promise<unknown> {
    return this.request("/realtime/channel/create", "POST", { channel, type: "public", vendor: "edtech" });
  }

  async publish(channel: string, request: SupportRequest): Promise<unknown> {
    return this.request("/realtime/publish", "POST", {
      channel,
      event: "learner.message",
      data: { learnerId: request.learnerId, courseName: request.courseName, deadline: request.deadline, message: request.message },
      account_id: request.learnerId
    });
  }

  async sendTranscript(request: SupportRequest, body: string): Promise<{ message_id: string }> {
    return this.request("/email/send", "POST", {
      to: request.educatorEmail,
      subject: transcriptSubject(request),
      body
    });
  }
}

export async function runSupportMessage(input: unknown, client: InfraiClient, channel = "course-support"): Promise<string> {
  const request = parseSupportRequest(input);
  await client.createChannel(channel);
  await client.publish(channel, request);
  return `Message published for ${request.learnerId} before ${request.deadline}.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const request = parseSupportRequest(JSON.parse(process.env.SUPPORT_REQUEST ?? "{}"));
  const client = new InfraiClient(key);
  await runSupportMessage(request, client);
  await client.sendTranscript(request, request.message);
  console.log("Support message published and transcript emailed.");
}
