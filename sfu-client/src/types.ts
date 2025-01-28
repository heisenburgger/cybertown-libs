import type {
  Transport,
  DtlsParameters,
  TransportOptions,
  RtpParameters,
  RtpCapabilities,
} from "mediasoup-client/lib/types";

export type Transports = {
  send?: Transport;
  recv?: Transport;
};

export type InitOptions = {
  routerRtpCapabilities: RtpCapabilities;
  sendTransportOptions?: TransportOptions;
  recvTransportOptions?: TransportOptions;
};

export type ConnectTransport = {
  dtlsParameters: DtlsParameters;
  direction: TransportDirection;
};

export type ProduceTransport = {
  rtpParameters: RtpParameters;
  producerKey: string;
};

export type ProduceEventCallback = {
  callback: (data: { id: string }) => void;
  errback: (err: Error) => void;
};

export type TrackSource =
  | "microphone"
  | "camera"
  | "screenshare-audio"
  | "screenshare-video";

export type ProducerAppData = {
  source: TrackSource;
};

export type ConsumerAppData = {
  source: TrackSource;
  userID: string;
};

export type TransportDirection = "send" | "recv";
