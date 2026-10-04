import { io, Socket } from 'socket.io-client';

export function connectOrdersSocket(
  token: string,
  baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
): Socket {
  const url = baseUrl.endsWith('/') ? `${baseUrl}orders` : `${baseUrl}/orders`;
  return io(url, {
    auth: { token },
    autoConnect: true,
  });
}
