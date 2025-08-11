declare module 'dns2' {
  const defaultExport: {
    UDPServer: (options: UDPServerOptions) => import('node:dgram').Socket & {
      on(event: 'listening', listener: () => void): any;
      on(event: 'close', listener: () => void): any;
      on(event: 'error', listener: (err: unknown) => void): any;
    };
  };
  export default defaultExport;

  export type DNSQuestion = {
    name: string;
    type: string | number;
    class?: string | number;
  };

  export type DNSAnswer = {
    name: string;
    type: string | number;
    class?: string | number;
    ttl?: number;
    address?: string;
    data?: unknown;
  };

  export type DNSRequest = {
    id: number;
    type?: string;
    flags?: number;
    questions: DNSQuestion[];
  };

  export type DNSResponse = {
    id: number;
    type: 'response';
    flags?: number;
    questions?: DNSQuestion[];
    answers?: DNSAnswer[];
    authorities?: DNSAnswer[];
    additionals?: DNSAnswer[];
  };

  export type UDPServerOptions = {
    udp?: {
      address?: string;
      port?: number;
    };
    handle: (request: DNSRequest, send: (response: DNSResponse) => void) => void;
  };

  export function UDPServer(options: UDPServerOptions): import('node:dgram').Socket & {
    on(event: 'listening', listener: () => void): any;
    on(event: 'close', listener: () => void): any;
    on(event: 'error', listener: (err: unknown) => void): any;
  };
}


