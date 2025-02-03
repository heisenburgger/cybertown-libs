import {
  Consumer,
  DtlsParameters,
  Producer,
  Router,
  RouterOptions,
  RtpParameters,
  WebRtcServerOptions,
  WebRtcTransport,
  WorkerSettings,
} from "mediasoup/node/lib/types.js";
import { Participant } from "./participant.js";

export type Room = {
  router: Router;
  participants: Record<string, Participant>;
};

export type Transports = {
  send: WebRtcTransport;
  recv: WebRtcTransport;
};

export type TransportDirection = "send" | "recv";

export type TrackSource =
  | "microphone"
  | "screenshare-audio"
  | "screenshare-video"
  | "camera";

type ProducerAppData = {
  source: TrackSource;
};

type ConsumerAppData = {
  source: TrackSource;
  participantID: string;
};

export type SFUProducer = Producer<ProducerAppData>;
export type SFUConsumer = Consumer<ConsumerAppData>;

export type ConnectTransportOptions = {
  direction: TransportDirection;
  dtlsParameters: DtlsParameters;
};

export type ProduceTransportOptions = {
  source: TrackSource;
  rtpParameters: RtpParameters;
};

export type ConsumeOptions = {
  sourceFilter: string;
  remoteParticipantID: string;
};

export type ProduceOptions = {};

export type InitOptions = {
  workerSettings: WorkerSettings;
  routerOptions: RouterOptions;
  transportOptions: WebRtcServerOptions;
};
